import { doc, setDoc, getDoc } from 'firebase/firestore';
import { addToSyncQueue, getSyncQueue, clearSyncQueue, storeQuestionState, getQuestionState } from './indexedDB';

// Configuration
const syncConfig = {
  minSessionAnswers: 5,       // Min answers before session sync
  maxSessionAnswers: 20,      // Force sync after this many
  syncInterval: 6 * 60 * 60 * 1000,  // Sync every 6 hours at minimum
  idleSync: true              // Sync during idle time
};

// In-memory queue for pending syncs during the current session
const pendingSyncs = [];

/**
 * Records an answer attempt and queues it for syncing
 * @param {string} questionId - The ID of the answered question
 * @param {boolean} isCorrect - Whether the answer was correct
 * @param {string} userId - Current user ID
 * @param {object} db - Firestore database reference
 * @param {boolean} isSessionEnding - Whether the session is ending (forces sync)
 */
export const recordAnswer = async (questionId, isCorrect, userId, db, isSessionEnding = false, category = null) => {
  // Create sync item
  const syncItem = {
    qid: questionId,
    result: isCorrect ? 1 : 0,
    ts: Date.now(),
    category
  };
  
  // Add to memory queue
  pendingSyncs.push(syncItem);
  
  // Also add to IndexedDB queue for persistence between sessions
  await addToSyncQueue(syncItem);
  
  // Process the new answer locally to update question state in IndexedDB
  await processAnswerLocally(questionId, isCorrect, syncItem.ts, category);
  
  // Determine if we should sync now
  if (isSessionEnding || 
      pendingSyncs.length >= syncConfig.maxSessionAnswers ||
      (pendingSyncs.length >= syncConfig.minSessionAnswers && checkLastSyncTime())) {
    return syncWithFirebase(userId, db);
  }
};

/**
 * Process an answer locally to update question state in IndexedDB
 * @param {string} questionId - The question ID
 * @param {boolean} isCorrect - Whether the answer was correct
 * @param {number} timestamp - The timestamp of the answer
 * @param {string} category - The category of the question
 */
const processAnswerLocally = async (questionId, isCorrect, timestamp, category) => {
  // Get current state from IndexedDB or create new one
  let state = await getQuestionState(questionId);
  
  if (!state) {
    state = {
      qid: questionId,
      lvl: 0,
      c: 0,
      i: 0,
      lrn: timestamp,
      due: timestamp,
      hist: '',
      category
    };
  }
  
  // Create new binary history by prepending latest result
  const newHistory = String(isCorrect ? 1 : 0) + (state.hist || '');
  
  // Keep history length manageable
  const trimmedHistory = newHistory.substring(0, 20);
  
  // Update counters
  if (isCorrect) {
    state.c += 1;
  } else {
    state.i += 1;
  }
  
  // Update level based on consecutive correct answers
  state.lvl = calculateLevel(trimmedHistory);
  
  // Update last review timestamp
  state.lrn = timestamp;
  
  // Calculate next due date
  state.due = calculateNextDueDate(state.lvl, timestamp, trimmedHistory);
  
  // Update history
  state.hist = trimmedHistory;
  
  // Store updated state in IndexedDB
  await storeQuestionState(state);
};

/**
 * Convert binary history string to a level using SM-2 algorithm
 * @param {string} binaryHistory - Binary history string (1=correct, 0=incorrect)
 * @returns {number} - The calculated level (0-15)
 */
const calculateLevel = (binaryHistory) => {
  if (!binaryHistory) return 0;
  
  let consecutiveCorrect = 0;
  for (let i = 0; i < binaryHistory.length; i++) {
    if (binaryHistory[i] === '1') {
      consecutiveCorrect++;
    } else {
      break;
    }
  }
  
  return Math.min(15, consecutiveCorrect);
};

/**
 * Calculate the next due date based on level and binary history
 * @param {number} level - Current level (0-15)
 * @param {number} timestamp - Last review timestamp
 * @param {string} binaryHistory - Binary history string
 * @returns {number} - Next due date timestamp
 */
const calculateNextDueDate = (level, timestamp, binaryHistory) => {
  // If the last answer was incorrect, review after 1 day
  if (binaryHistory && binaryHistory[0] === '0') {
    return timestamp + (24 * 60 * 60 * 1000);
  }
  
  // Fibonacci-based intervals
  const fibonacci = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
  const intervalDays = fibonacci[level];
  
  return timestamp + (intervalDays * 24 * 60 * 60 * 1000);
};

/**
 * Check if we should sync based on last sync time
 * @returns {boolean} Whether we should sync
 */
const checkLastSyncTime = () => {
  const lastSyncTime = localStorage.getItem('lastSyncTime');
  if (!lastSyncTime) return true;
  
  const timeSinceLastSync = Date.now() - parseInt(lastSyncTime);
  return timeSinceLastSync > syncConfig.syncInterval;
};

/**
 * Synchronizes pending answers with Firebase in a single batch
 * @param {string} userId - Current user ID
 * @param {object} db - Firestore database reference
 */
export const syncWithFirebase = async (userId, db) => {
  if (!userId || !db) return;
  
  try {
    // Combine memory queue with IndexedDB queue
    const idbQueue = await getSyncQueue();
    const allSyncs = [...pendingSyncs, ...idbQueue];
    
    if (allSyncs.length === 0) {
      console.log('No syncs to process');
      return;
    }
    
    // Group by question ID to consolidate multiple answers to same question
    const byQuestion = {};
    allSyncs.forEach(sync => {
      if (!byQuestion[sync.qid]) byQuestion[sync.qid] = [];
      byQuestion[sync.qid].push(sync);
    });
    
    // Get current question states from Firestore (one read)
    const spacedDoc = await getDoc(doc(db, `users/${userId}/data/spaced`));
    const questionStates = spacedDoc.exists() ? (spacedDoc.data().questionStates || {}) : {};
    
    // Update question states with new answers
    Object.entries(byQuestion).forEach(([qid, syncs]) => {
      // Sort syncs by timestamp (oldest first, so we process chronologically)
      syncs.sort((a, b) => a.ts - b.ts);
      
      // Get existing state or create new one
      const state = questionStates[qid] || {
        qid,
        lvl: 0,
        c: 0,
        i: 0,
        lrn: syncs[0].ts,
        due: syncs[0].ts,
        hist: '',
        category: syncs[0].category
      };
      
      // Process each sync in order
      syncs.forEach(sync => {
        // Create new binary history by prepending latest result
        const newHistory = String(sync.result) + (state.hist || '');
        
        // Keep history length manageable
        const trimmedHistory = newHistory.substring(0, 20);
        
        // Update counters
        if (sync.result === 1) {
          state.c += 1;
        } else {
          state.i += 1;
        }
        
        // Update level based on consecutive correct answers
        state.lvl = calculateLevel(trimmedHistory);
        
        // Update last review timestamp
        state.lrn = sync.ts;
        
        // Calculate next due date
        state.due = calculateNextDueDate(state.lvl, sync.ts, trimmedHistory);
        
        // Update history
        state.hist = trimmedHistory;
        
        // Add category if it exists
        if (sync.category) {
          state.category = sync.category;
        }
      });
      
      // Update the state in our collection
      questionStates[qid] = state;
    });
    
    // ONE Firestore write with all updates and the updated question states
    await setDoc(doc(db, `users/${userId}/data/spaced`), {
      updates: Object.entries(byQuestion).map(([qid, syncs]) => ({
        qid,
        results: syncs.map(s => s.result).join(''),
        ts: syncs[syncs.length - 1].ts
      })),
      questionStates,
      syncTime: Date.now()
    }, { merge: true });
    
    // Clear sync queues after successful sync
    pendingSyncs.length = 0;
    await clearSyncQueue();
    
    // Update last sync time
    localStorage.setItem('lastSyncTime', Date.now().toString());
    
    console.log('Successfully synced learning state with Firestore');
  } catch (error) {
    console.error("Sync failed, will try again later", error);
  }
};

/**
 * Forces an immediate sync with Firebase
 * @param {string} userId - Current user ID
 * @param {object} db - Firestore database reference
 */
export const forceSyncWithFirebase = (userId, db) => {
  return syncWithFirebase(userId, db);
};

/**
 * Gets the number of pending syncs
 * @returns {number} The number of syncs in the queue
 */
export const getPendingSyncsCount = async () => {
  const idbQueue = await getSyncQueue();
  return pendingSyncs.length + idbQueue.length;
};

/**
 * Initialize the sync system with periodic syncs and visibility change detection
 * @param {string} userId - Current user ID
 * @param {object} db - Firestore database reference
 */
export const initSyncSystem = (userId, db) => {
  // Check for last sync time and sync if needed
  const lastSyncTime = localStorage.getItem('lastSyncTime');
  const now = Date.now();
  
  if (!lastSyncTime || now - parseInt(lastSyncTime) > syncConfig.syncInterval) {
    syncWithFirebase(userId, db);
  }
  
  // Listen for page visibility changes to sync when tab becomes hidden
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && userId && db) {
      getPendingSyncsCount().then(count => {
        if (count > 0) {
          syncWithFirebase(userId, db);
        }
      });
    }
  });
  
  // Use requestIdleCallback if available for background syncing
  if (window.requestIdleCallback && syncConfig.idleSync) {
    const scheduleIdleSync = () => {
      window.requestIdleCallback(() => {
        getPendingSyncsCount().then(count => {
          if (count > 0) {
            syncWithFirebase(userId, db).finally(() => {
              // Schedule next idle sync
              scheduleIdleSync();
            });
          } else {
            // If no pending syncs, check again later
            setTimeout(scheduleIdleSync, 60000);
          }
        });
      }, { timeout: 10000 });
    };
    
    scheduleIdleSync();
  }
}; 