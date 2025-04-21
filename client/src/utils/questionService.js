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

    // If we have enough cached questions, return them
    if (questions.length >= count) {
      console.log(`Returning ${count} questions from cache`);
      // Shuffle the questions and return the requested count
      return shuffleArray(questions).slice(0, count);
    }

    // Otherwise, fetch from Firestore
    console.log(`Fetching questions from Firestore for categories: ${categories.join(', ')}`);
    const questionsRef = collection(db, 'questions');
    const categoryPromises = categories.map(async (category) => {
      const q = query(
        questionsRef,
        where('category', '==', category),
        limit(BUNDLE_SIZE)
      );

      const querySnapshot = await getDocs(q);
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

    // Combine cached and fetched questions, removing duplicates
    const combinedQuestions = useCache
      ? [...questions, ...fetchedQuestions.filter(q => !questions.some(cq => cq.id === q.id))]
      : fetchedQuestions;

    // Shuffle the questions and return the requested count
    return shuffleArray(combinedQuestions).slice(0, Math.min(count, combinedQuestions.length));
  } catch (error) {
    console.error('Error fetching questions by categories:', error);
    
    // Initialize an empty array for cached questions if not using cache
    const cachedQuestions = [];
    
    // If we have cached questions, return them in case of error
    if (useCache) {
      // Try to get cached questions as fallback
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

    // Stagger requests to avoid overwhelming Firestore
    for (const category of categoriesToLoad) {
      // Wait a bit between requests
      if (categoriesToLoad.indexOf(category) > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`Preloading category: ${category}`);
      try {
        const questionsRef = collection(db, 'questions');
        const q = query(
          questionsRef,
          where('category', '==', category),
          limit(BUNDLE_SIZE)
        );
        
        const querySnapshot = await getDocs(q);
        const categoryQuestions = [];
        
        querySnapshot.forEach((doc) => {
          categoryQuestions.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        if (categoryQuestions.length > 0) {
          console.log(`Caching ${categoryQuestions.length} questions for ${category}`);
          await cacheQuestions(categoryQuestions);
        }
      } catch (error) {
        console.error(`Error preloading category ${category}:`, error);
        // Continue with other categories
      }
    }
    
    console.log('Preloading complete');
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