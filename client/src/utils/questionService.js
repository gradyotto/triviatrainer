import { db } from '../firebase';
import { collection, getDocs, query, where, doc, getDoc, limit } from 'firebase/firestore';
import { 
  cacheQuestions, 
  getCachedQuestions, 
  clearQuestionCache 
} from './indexedDB';

// Constants
const BUNDLE_SIZE = 50; // Number of questions to fetch at once
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Track Firestore read operations for monitoring
let firestoreReadCounter = {
  session: 0,
  daily: 0,
  lastResetDate: new Date().toDateString()
};

// Reset daily counter if it's a new day
const checkAndResetDailyCounter = () => {
  const today = new Date().toDateString();
  if (today !== firestoreReadCounter.lastResetDate) {
    firestoreReadCounter.daily = 0;
    firestoreReadCounter.lastResetDate = today;
  }
};

// Increment read counter
const incrementReads = (count = 1) => {
  checkAndResetDailyCounter();
  firestoreReadCounter.session += count;
  firestoreReadCounter.daily += count;
  
  // Log at certain thresholds
  if (firestoreReadCounter.daily % 1000 === 0) {
    console.warn(`⚠️ Firestore daily reads: ${firestoreReadCounter.daily}`);
  }
  
  // Store in localStorage for persistence
  try {
    localStorage.setItem('firestoreReadCounter', JSON.stringify(firestoreReadCounter));
  } catch (e) {
    console.error('Error saving read counter to localStorage', e);
  }
};

// Initialize counter from localStorage if available
try {
  const savedCounter = localStorage.getItem('firestoreReadCounter');
  if (savedCounter) {
    const parsed = JSON.parse(savedCounter);
    // Reset daily counter if it's a new day
    if (parsed.lastResetDate !== new Date().toDateString()) {
      parsed.daily = 0;
      parsed.lastResetDate = new Date().toDateString();
    }
    firestoreReadCounter = parsed;
    console.log(`Loaded read counter: ${firestoreReadCounter.daily} reads today, ${firestoreReadCounter.session} in this session`);
  }
} catch (e) {
  console.error('Error loading read counter from localStorage', e);
}

// Export for external monitoring
export const getFirestoreReadCount = () => {
  checkAndResetDailyCounter();
  return { ...firestoreReadCounter };
};

/**
 * Fetch questions by categories with caching support
 * @param {Array} categories - Array of category names to fetch questions for
 * @param {number} count - Number of questions to fetch
 * @param {boolean} useCache - Whether to use cached questions (default: true)
 * @returns {Promise<Array>} - Array of question objects
 */
export const fetchQuestionsByCategories = async (categories, count = 10, useCache = true) => {
  if (!categories || categories.length === 0) {
    console.error('No categories provided to fetchQuestionsByCategories');
    return [];
  }

  try {
    // Check cache first if enabled
    let questions = [];
    if (useCache) {
      console.log('Checking cache for questions in categories:', categories);
      questions = await getCachedQuestions(categories, MAX_CACHE_AGE);
      console.log(`Found ${questions.length} cached questions`);
    }

    // Group cached questions by category
    const cachedByCategory = {};
    categories.forEach(category => {
      cachedByCategory[category] = questions.filter(q => q.category === category);
      console.log(`Cached questions for ${category}: ${cachedByCategory[category].length}`);
    });

    // If we have enough questions in cache for each category, create a balanced selection
    const questionsPerCategory = Math.ceil(count / categories.length);
    const allCategoriesHaveEnough = categories.every(
      category => cachedByCategory[category].length >= questionsPerCategory
    );

    if (allCategoriesHaveEnough) {
      console.log('All categories have enough cached questions for a balanced set');
      // Create a balanced set of questions from each category
      const balancedQuestions = [];
      categories.forEach(category => {
        const categoryQuestions = shuffleArray(cachedByCategory[category]);
        balancedQuestions.push(...categoryQuestions.slice(0, questionsPerCategory));
      });
      
      // Shuffle the final selection and limit to requested count
      return shuffleArray(balancedQuestions).slice(0, count);
    }

    // If we don't have enough cached questions, determine which categories need to be fetched
    const categoriesToFetch = categories.filter(
      category => cachedByCategory[category].length < questionsPerCategory
    );
    
    if (categoriesToFetch.length > 0) {
      console.log(`Fetching questions from Firestore for categories: ${categoriesToFetch.join(', ')}`);
      const questionsRef = collection(db, 'questions');
      
      // Calculate how many questions to request per category to minimize reads
      const maxQuestionsPerFetch = Math.min(BUNDLE_SIZE, Math.ceil((count - questions.length) / categoriesToFetch.length));
      
      const categoryPromises = categoriesToFetch.map(async (category) => {
        const q = query(
          questionsRef,
          where('category', '==', category),
          limit(maxQuestionsPerFetch)
        );

        const querySnapshot = await getDocs(q);
        // Track Firestore reads (1 read per document)
        incrementReads(querySnapshot.size);
        
        const categoryQuestions = [];
        
        querySnapshot.forEach((doc) => {
          categoryQuestions.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        return categoryQuestions;
      });

      const categoryResults = await Promise.all(categoryPromises);
      const fetchedQuestions = categoryResults.flat();
      
      console.log(`Fetched ${fetchedQuestions.length} questions from Firestore`);

      // Cache the fetched questions
      if (fetchedQuestions.length > 0) {
        console.log('Caching fetched questions');
        await cacheQuestions(fetchedQuestions);
      }

      // Group fetched questions by category
      const fetchedByCategory = {};
      categoriesToFetch.forEach(category => {
        fetchedByCategory[category] = fetchedQuestions.filter(q => q.category === category);
      });

      // Create a balanced set of questions
      const balancedQuestions = [];
      
      // Add the fetched questions first
      categories.forEach(category => {
        const categoryQuestions = [...(cachedByCategory[category] || [])];
        
        // Add newly fetched questions for this category if available
        if (fetchedByCategory[category]) {
          categoryQuestions.push(...fetchedByCategory[category].filter(
            q => !categoryQuestions.some(cq => cq.id === q.id)
          ));
        }
        
        // Shuffle and take questions for this category
        const shuffled = shuffleArray(categoryQuestions);
        balancedQuestions.push(...shuffled.slice(0, questionsPerCategory));
      });
      
      // Shuffle the final balanced set
      return shuffleArray(balancedQuestions).slice(0, count);
    } else {
      // All categories have at least some cached questions, just not enough for a perfectly balanced set
      // Create the most balanced set possible with what we have
      const balancedQuestions = [];
      categories.forEach(category => {
        const shuffled = shuffleArray(cachedByCategory[category] || []);
        balancedQuestions.push(...shuffled.slice(0, questionsPerCategory));
      });
      
      if (balancedQuestions.length >= count) {
        console.log(`Returning ${count} questions from cache (partially balanced)`);
        return shuffleArray(balancedQuestions).slice(0, count);
      } else {
        console.log('Not enough cached questions for all categories, returning what we have');
        return shuffleArray(questions).slice(0, count);
      }
    }
  } catch (error) {
    console.error('Error fetching questions by categories:', error);
    
    // If we have cached questions, return them in case of error
    if (useCache) {
      try {
        const cachedQuestions = await getCachedQuestions(categories, MAX_CACHE_AGE);
        if (cachedQuestions && cachedQuestions.length > 0) {
          console.log(`Returning ${Math.min(count, cachedQuestions.length)} cached questions due to fetch error`);
          return shuffleArray(cachedQuestions).slice(0, Math.min(count, cachedQuestions.length));
        }
      } catch (cacheError) {
        console.error('Error accessing cache:', cacheError);
      }
    }
    
    return [];
  }
};

/**
 * Preload questions for all specified categories
 * @param {Array} categories - Array of category names to preload
 * @returns {Promise<void>}
 */
export const preloadAllCategories = async (categories) => {
  if (!categories || categories.length === 0) return;

  try {
    // Get existing cached questions
    const cachedQuestions = await getCachedQuestions(categories);
    
    // Group cached questions by category
    const questionsByCategory = {};
    categories.forEach(category => {
      questionsByCategory[category] = cachedQuestions.filter(q => q.category === category);
      console.log(`Cached questions for ${category}: ${questionsByCategory[category].length}/${BUNDLE_SIZE} target`);
    });
    
    // Determine which categories need more questions
    const categoriesToLoad = categories.filter(
      category => !questionsByCategory[category] || questionsByCategory[category].length < BUNDLE_SIZE
    );
    
    if (categoriesToLoad.length === 0) {
      console.log('All categories have sufficient cached questions');
      return;
    }
    
    console.log(`Preloading questions for categories: ${categoriesToLoad.join(', ')}`);

    // Create a single batch request for all needed categories (if possible in your DB structure)
    // This would be ideal to reduce reads, but requires your DB structure to support it
    // If not possible, we'll use the staggered approach below

    // Stagger requests to avoid overwhelming Firestore, but optimize the number of questions requested
    for (const category of categoriesToLoad) {
      // Wait a bit between requests
      if (categoriesToLoad.indexOf(category) > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Calculate how many more questions are needed for this category
      const currentCount = questionsByCategory[category]?.length || 0;
      const neededCount = BUNDLE_SIZE - currentCount;
      
      console.log(`Preloading category: ${category} (need ${neededCount} more questions)`);
      
      try {
        const questionsRef = collection(db, 'questions');
        const q = query(
          questionsRef,
          where('category', '==', category),
          limit(neededCount) // Only fetch what we need
        );
        
        const querySnapshot = await getDocs(q);
        // Track Firestore reads (1 read per document)
        incrementReads(querySnapshot.size);
        
        const categoryQuestions = [];
        
        querySnapshot.forEach((doc) => {
          // Check that we don't already have this question cached
          const questionId = doc.id;
          if (!questionsByCategory[category]?.some(q => q.id === questionId)) {
            categoryQuestions.push({
              id: questionId,
              ...doc.data()
            });
          }
        });
        
        if (categoryQuestions.length > 0) {
          console.log(`Caching ${categoryQuestions.length} questions for ${category}`);
          await cacheQuestions(categoryQuestions);
        } else {
          console.log(`No new questions found for ${category}`);
        }
      } catch (error) {
        console.error(`Error preloading category ${category}:`, error);
        // Continue with other categories
      }
    }
    
    // Log a summary of the cache state after preloading
    try {
      const updatedCachedQuestions = await getCachedQuestions(categories);
      const summary = categories.map(category => {
        const count = updatedCachedQuestions.filter(q => q.category === category).length;
        return `${category}: ${count}`;
      }).join(', ');
      console.log(`Preloading complete. Cache summary: ${summary}`);
    } catch (error) {
      console.log('Preloading complete. Could not get cache summary.');
    }
  } catch (error) {
    console.error('Error in preloading categories:', error);
  }
};

/**
 * Fetch a single question by ID
 * @param {string} questionId - The ID of the question to fetch
 * @param {boolean} useCache - Whether to check cache first (default: true)
 * @returns {Promise<Object|null>} - Question object or null if not found
 */
export const fetchQuestionById = async (questionId, useCache = true) => {
  if (!questionId) {
    console.error('No questionId provided to fetchQuestionById');
    return null;
  }

  try {
    // Check cache first if enabled
    if (useCache) {
      const cachedQuestions = await getCachedQuestions();
      const cachedQuestion = cachedQuestions.find(q => q.id === questionId);
      
      if (cachedQuestion) {
        console.log(`Found question ${questionId} in cache`);
        return cachedQuestion;
      }
    }

    // Fetch from Firestore if not in cache
    console.log(`Fetching question ${questionId} from Firestore`);
    const questionDoc = await getDoc(doc(db, 'questions', questionId));
    // Track Firestore reads (1 read)
    incrementReads(1);

    if (questionDoc.exists()) {
      const question = {
        id: questionDoc.id,
        ...questionDoc.data()
      };
      
      // Cache the question
      await cacheQuestions([question]);
      
      return question;
    } else {
      console.log(`Question ${questionId} not found in Firestore`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching question ${questionId}:`, error);
    return null;
  }
};

/**
 * Utility function to shuffle an array using Fisher-Yates algorithm
 * @param {Array} array - The array to shuffle
 * @returns {Array} - The shuffled array
 */
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}; 