// IndexedDB utility functions for local learning state management

// Constants
const DB_NAME = 'triviaTrainerDB';
const DB_VERSION = 1;
const QUESTIONS_STORE = 'questions';
const LEARNING_STORE = 'learningState';

/**
 * Initialize the IndexedDB database for learning state
 * @returns {Promise<IDBDatabase>} The opened database
 */
export const initLearningDB = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('spacedRepetitionDB', 1);
    
    request.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('learningState')) {
        const store = db.createObjectStore('learningState', { keyPath: 'qid' });
        store.createIndex('due', 'due', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
      
      if (!db.objectStoreNames.contains('questionCache')) {
        const questionStore = db.createObjectStore('questionCache', { keyPath: 'id' });
        questionStore.createIndex('category', 'category', { unique: false });
      }
    };
    
    request.onsuccess = e => resolve(e.target.result);
    request.onerror = e => reject(e.target.error);
  });
};

/**
 * Get due questions from IndexedDB
 * @param {Array} categories - Optional categories to filter by
 * @returns {Promise<Array>} Array of due question states
 */
export const getDueQuestions = async (categories = []) => {
  const db = await initLearningDB();
  const transaction = db.transaction('learningState', 'readonly');
  const store = transaction.objectStore('learningState');
  const dueIndex = store.index('due');
  
  return new Promise((resolve, reject) => {
    const now = Date.now();
    const request = dueIndex.openCursor(IDBKeyRange.upperBound(now));
    const dueQuestions = [];
    
    request.onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) {
        const questionState = cursor.value;
        
        // Filter by category if categories are specified
        if (categories.length === 0 || categories.includes(questionState.category)) {
          dueQuestions.push(questionState);
        }
        cursor.continue();
      } else {
        resolve(dueQuestions);
      }
    };
    
    request.onerror = e => reject(e.target.error);
  });
};

/**
 * Calculate due counts per category from IndexedDB
 * @returns {Promise<Object>} Object with category keys and count values
 */
export const calculateDueCounts = async () => {
  const allDueQuestions = await getDueQuestions();
  
  // Group by category
  return allDueQuestions.reduce((counts, question) => {
    const category = question.category;
    if (category) {
      counts[category] = (counts[category] || 0) + 1;
    }
    return counts;
  }, {});
};

/**
 * Store or update a question state in IndexedDB
 * @param {Object} questionState - The question state to store
 * @returns {Promise<void>}
 */
export const storeQuestionState = async (questionState) => {
  const db = await initLearningDB();
  const transaction = db.transaction('learningState', 'readwrite');
  const store = transaction.objectStore('learningState');
  
  return new Promise((resolve, reject) => {
    const request = store.put(questionState);
    request.onsuccess = () => resolve();
    request.onerror = e => reject(e.target.error);
  });
};

/**
 * Get a question state from IndexedDB
 * @param {string} questionId - The question ID
 * @returns {Promise<Object|null>} The question state or null if not found
 */
export const getQuestionState = async (questionId) => {
  const db = await initLearningDB();
  const transaction = db.transaction('learningState', 'readonly');
  const store = transaction.objectStore('learningState');
  
  return new Promise((resolve, reject) => {
    const request = store.get(questionId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = e => reject(e.target.error);
  });
};

/**
 * Add an answer to the sync queue
 * @param {Object} syncItem - The sync item with question ID, result, and timestamp
 * @returns {Promise<void>}
 */
export const addToSyncQueue = async (syncItem) => {
  const db = await initLearningDB();
  const transaction = db.transaction('syncQueue', 'readwrite');
  const store = transaction.objectStore('syncQueue');
  
  return new Promise((resolve, reject) => {
    const request = store.add(syncItem);
    request.onsuccess = () => resolve();
    request.onerror = e => reject(e.target.error);
  });
};

/**
 * Get all items in the sync queue
 * @returns {Promise<Array>} Array of sync items
 */
export const getSyncQueue = async () => {
  const db = await initLearningDB();
  const transaction = db.transaction('syncQueue', 'readonly');
  const store = transaction.objectStore('syncQueue');
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = e => reject(e.target.error);
  });
};

/**
 * Clear the sync queue
 * @returns {Promise<void>}
 */
export const clearSyncQueue = async () => {
  const db = await initLearningDB();
  const transaction = db.transaction('syncQueue', 'readwrite');
  const store = transaction.objectStore('syncQueue');
  
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = e => reject(e.target.error);
  });
};

/**
 * Cache questions by category
 * @param {string} category - The category name
 * @param {Array} questions - Array of questions
 * @returns {Promise<void>}
 */
export const cacheQuestions = async (questions) => {
  if (!questions || !questions.length) return;
  
  try {
    const db = await initDB();
    const transaction = db.transaction(QUESTIONS_STORE, 'readwrite');
    const store = transaction.objectStore(QUESTIONS_STORE);
    
    // Add timestamp for cache freshness
    const timestamp = Date.now();
    
    for (const question of questions) {
      store.put({
        ...question,
        lastUpdated: timestamp
      });
    }
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log(`Cached ${questions.length} questions successfully`);
        resolve();
      };
      
      transaction.onerror = event => {
        console.error('Error caching questions:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Error accessing IndexedDB for caching:', error);
    throw error;
  }
};

/**
 * Retrieve cached questions from IndexedDB
 * @param {Array} categories - Optional array of categories to filter by
 * @param {number} maxAge - Optional maximum age in milliseconds
 * @returns {Promise<Array>} - Array of cached questions
 */
export const getCachedQuestions = async (categories = [], maxAge = 7 * 24 * 60 * 60 * 1000) => {
  try {
    const db = await initDB();
    const transaction = db.transaction(QUESTIONS_STORE, 'readonly');
    const store = transaction.objectStore(QUESTIONS_STORE);
    
    return new Promise((resolve, reject) => {
      // If categories specified, use multiple gets by index
      if (categories && categories.length > 0) {
        const results = [];
        let pending = categories.length;
        
        categories.forEach(category => {
          const index = store.index('category');
          const request = index.getAll(category);
          
          request.onsuccess = event => {
            const categoryQuestions = event.target.result || [];
            const threshold = Date.now() - maxAge;
            
            // Filter by age if maxAge provided
            const freshQuestions = categoryQuestions.filter(q => 
              !maxAge || (q.lastUpdated && q.lastUpdated > threshold)
            );
            
            results.push(...freshQuestions);
            pending--;
            
            if (pending === 0) {
              resolve(results);
            }
          };
          
          request.onerror = event => {
            console.error(`Error retrieving questions for ${category}:`, event.target.error);
            pending--;
            
            if (pending === 0) {
              resolve(results);
            }
          };
        });
      } else {
        // Get all questions if no categories specified
        const request = store.getAll();
        
        request.onsuccess = event => {
          const allQuestions = event.target.result || [];
          const threshold = Date.now() - maxAge;
          
          // Filter by age if maxAge provided
          const freshQuestions = maxAge
            ? allQuestions.filter(q => q.lastUpdated && q.lastUpdated > threshold)
            : allQuestions;
          
          resolve(freshQuestions);
        };
        
        request.onerror = event => {
          console.error('Error retrieving all questions:', event.target.error);
          reject(event.target.error);
        };
      }
    });
  } catch (error) {
    console.error('Error accessing IndexedDB for retrieval:', error);
    return [];
  }
};

/**
 * Clear the question cache for specific categories or all
 * @param {Array} categories - Optional array of categories to clear
 * @returns {Promise<void>}
 */
export const clearQuestionCache = async (categories = []) => {
  try {
    const db = await initDB();
    const transaction = db.transaction(QUESTIONS_STORE, 'readwrite');
    const store = transaction.objectStore(QUESTIONS_STORE);
    
    return new Promise((resolve, reject) => {
      if (categories && categories.length > 0) {
        let completed = 0;
        const categoryIndex = store.index('category');
        
        categories.forEach(category => {
          const keyRange = IDBKeyRange.only(category);
          const request = categoryIndex.openCursor(keyRange);
          
          request.onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else {
              completed++;
              if (completed === categories.length) {
                console.log(`Cleared cache for categories: ${categories.join(', ')}`);
                resolve();
              }
            }
          };
          
          request.onerror = event => {
            console.error(`Error clearing cache for ${category}:`, event.target.error);
            completed++;
            if (completed === categories.length) {
              resolve();
            }
          };
        });
      } else {
        // Clear all questions
        const request = store.clear();
        
        request.onsuccess = () => {
          console.log('Cleared entire question cache');
          resolve();
        };
        
        request.onerror = event => {
          console.error('Error clearing question cache:', event.target.error);
          reject(event.target.error);
        };
      }
    });
  } catch (error) {
    console.error('Error accessing IndexedDB for cache clearing:', error);
    throw error;
  }
};

/**
 * Store user's learning state in IndexedDB
 * @param {string} questionId - Question ID
 * @param {Object} learningState - Learning state object
 * @returns {Promise<void>}
 */
export const storeLearningState = async (questionId, learningState) => {
  if (!questionId || !learningState) return;
  
  try {
    const db = await initDB();
    const transaction = db.transaction(LEARNING_STORE, 'readwrite');
    const store = transaction.objectStore(LEARNING_STORE);
    
    store.put({
      questionId,
      ...learningState,
      lastUpdated: Date.now()
    });
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = event => reject(event.target.error);
    });
  } catch (error) {
    console.error('Error storing learning state:', error);
    throw error;
  }
};

/**
 * Bulk store learning states
 * @param {Object} learningStates - Object mapping questionIds to learning states
 * @returns {Promise<void>}
 */
export const bulkStoreLearningStates = async (learningStates) => {
  if (!learningStates || Object.keys(learningStates).length === 0) return;
  
  try {
    const db = await initDB();
    const transaction = db.transaction(LEARNING_STORE, 'readwrite');
    const store = transaction.objectStore(LEARNING_STORE);
    const timestamp = Date.now();
    
    for (const [questionId, state] of Object.entries(learningStates)) {
      store.put({
        questionId,
        ...state,
        lastUpdated: timestamp
      });
    }
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log(`Stored ${Object.keys(learningStates).length} learning states`);
        resolve();
      };
      transaction.onerror = event => reject(event.target.error);
    });
  } catch (error) {
    console.error('Error bulk storing learning states:', error);
    throw error;
  }
};

/**
 * Get learning state for a question
 * @param {string} questionId - Question ID
 * @returns {Promise<Object|null>} - Learning state or null if not found
 */
export const getLearningState = async (questionId) => {
  if (!questionId) return null;
  
  try {
    const db = await initDB();
    const transaction = db.transaction(LEARNING_STORE, 'readonly');
    const store = transaction.objectStore(LEARNING_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.get(questionId);
      
      request.onsuccess = event => {
        resolve(event.target.result || null);
      };
      
      request.onerror = event => {
        console.error(`Error getting learning state for ${questionId}:`, event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Error accessing IndexedDB for learning state:', error);
    return null;
  }
};

/**
 * Get all learning states from IndexedDB
 * @returns {Promise<Object>} - Map of questionIds to learning states
 */
export const getAllLearningStates = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction(LEARNING_STORE, 'readonly');
    const store = transaction.objectStore(LEARNING_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = event => {
        const states = event.target.result || [];
        const stateMap = {};
        
        states.forEach(state => {
          const { questionId, ...rest } = state;
          stateMap[questionId] = rest;
        });
        
        resolve(stateMap);
      };
      
      request.onerror = event => {
        console.error('Error getting all learning states:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Error accessing IndexedDB for learning states:', error);
    return {};
  }
};

// IndexedDB utilities for offline support

// Initialize the database
export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create learning states store
      if (!db.objectStoreNames.contains(LEARNING_STORE)) {
        const learningStore = db.createObjectStore(LEARNING_STORE, { keyPath: 'questionId' });
        learningStore.createIndex('userId', 'userId', { unique: false });
        learningStore.createIndex('nextReviewDate', 'nextReviewDate', { unique: false });
      }
      
      // Create questions store
      if (!db.objectStoreNames.contains(QUESTIONS_STORE)) {
        const questionsStore = db.createObjectStore(QUESTIONS_STORE, { keyPath: 'id' });
        questionsStore.createIndex('category', 'category', { unique: false });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(db);
    };
    
    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
  });
};

// Store a question in IndexedDB
export const storeQuestion = async (question) => {
  try {
    const db = await initLearningDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([QUESTIONS_STORE], 'readwrite');
      const store = transaction.objectStore(QUESTIONS_STORE);
      const request = store.put(question);
      
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => {
        console.error('Error storing question:', event.target.error);
        reject(event.target.error);
      };
      
      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Failed to store question:', error);
    return false;
  }
};

// Store multiple questions in IndexedDB
export const storeQuestions = async (questions) => {
  if (!questions || questions.length === 0) return false;
  
  try {
    const db = await initLearningDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([QUESTIONS_STORE], 'readwrite');
      const store = transaction.objectStore(QUESTIONS_STORE);
      
      let successCount = 0;
      
      questions.forEach(question => {
        const request = store.put(question);
        request.onsuccess = () => successCount++;
      });
      
      transaction.oncomplete = () => {
        db.close();
        resolve(successCount === questions.length);
      };
      
      transaction.onerror = (event) => {
        console.error('Error storing questions:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Failed to store questions:', error);
    return false;
  }
};

// Get questions by category
export const getQuestionsByCategory = async (categories) => {
  if (!categories || categories.length === 0) return [];
  
  try {
    const db = await initLearningDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([QUESTIONS_STORE], 'readonly');
      const store = transaction.objectStore(QUESTIONS_STORE);
      const index = store.index('category');
      const questions = [];
      
      // This is a simplified approach - in a real app, you'd use a more efficient query
      const request = store.getAll();
      
      request.onsuccess = () => {
        const results = request.result.filter(question => 
          categories.includes(question.category)
        );
        resolve(results);
      };
      
      request.onerror = (event) => {
        console.error('Error getting questions:', event.target.error);
        reject(event.target.error);
      };
      
      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Failed to get questions:', error);
    return [];
  }
};

// Store learning state for a question
export const storeLearningStateById = async (questionId, userId, history, nextReviewDate) => {
  try {
    const db = await initLearningDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LEARNING_STORE], 'readwrite');
      const store = transaction.objectStore(LEARNING_STORE);
      
      const learningState = {
        questionId,
        userId,
        history,
        nextReviewDate
      };
      
      const request = store.put(learningState);
      
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => {
        console.error('Error storing learning state:', event.target.error);
        reject(event.target.error);
      };
      
      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Failed to store learning state:', error);
    return false;
  }
};

// Get learning state for a question
export const getLearningStateById = async (questionId, userId) => {
  try {
    const db = await initLearningDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LEARNING_STORE], 'readonly');
      const store = transaction.objectStore(LEARNING_STORE);
      const request = store.get(questionId);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.userId === userId) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = (event) => {
        console.error('Error getting learning state:', event.target.error);
        reject(event.target.error);
      };
      
      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Failed to get learning state:', error);
    return null;
  }
};

// Get all learning states for a user
export const getAllLearningStatesByUser = async (userId) => {
  try {
    const db = await initLearningDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LEARNING_STORE], 'readonly');
      const store = transaction.objectStore(LEARNING_STORE);
      const index = store.index('userId');
      const request = index.getAll(userId);
      
      request.onsuccess = () => resolve(request.result || []);
      
      request.onerror = (event) => {
        console.error('Error getting learning states:', event.target.error);
        reject(event.target.error);
      };
      
      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Failed to get learning states:', error);
    return [];
  }
};

// Get questions due for review
export const getDueQuestionsByUser = async (userId, categories = []) => {
  try {
    // Get all learning states for the user
    const learningStates = await getAllLearningStatesByUser(userId);
    if (!learningStates || learningStates.length === 0) return [];
    
    // Filter for questions that are due for review (nextReviewDate <= now)
    const now = new Date();
    const dueStates = learningStates.filter(state => 
      new Date(state.nextReviewDate) <= now
    );
    
    if (dueStates.length === 0) return [];
    
    // Get the corresponding questions
    const db = await initLearningDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([QUESTIONS_STORE], 'readonly');
      const store = transaction.objectStore(QUESTIONS_STORE);
      const dueQuestions = [];
      
      let completed = 0;
      
      dueStates.forEach(state => {
        const request = store.get(state.questionId);
        
        request.onsuccess = () => {
          completed++;
          const question = request.result;
          
          if (question && (categories.length === 0 || categories.includes(question.category))) {
            dueQuestions.push({
              ...question,
              nextReviewDate: state.nextReviewDate,
              history: state.history
            });
          }
          
          if (completed === dueStates.length) {
            resolve(dueQuestions);
          }
        };
        
        request.onerror = (event) => {
          completed++;
          console.error('Error getting question:', event.target.error);
          
          if (completed === dueStates.length) {
            resolve(dueQuestions);
          }
        };
      });
      
      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Failed to get due questions:', error);
    return [];
  }
};

// Sync data with server when back online
export const syncWithServer = async (userId, apiEndpoint) => {
  try {
    // Get all offline learning states
    const learningStates = await getAllLearningStatesByUser(userId);
    
    if (!learningStates || learningStates.length === 0) {
      return { success: true, message: 'No data to sync' };
    }
    
    // Send data to server
    const response = await fetch(`${apiEndpoint}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, learningStates }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to sync with server');
    }
    
    return { success: true, message: 'Sync completed successfully' };
  } catch (error) {
    console.error('Sync error:', error);
    return { success: false, message: error.message };
  }
}; 