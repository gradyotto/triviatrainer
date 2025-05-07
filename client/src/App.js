import React, { useState, useEffect, useRef } from 'react';
import { auth, db, app } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendEmailVerification } from 'firebase/auth';
import { collection, getDocs, doc, addDoc, getDoc, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import Header from './Header';
import CategorySelection from './CategorySelection';
import QuestionScreen from './QuestionScreen';
import ReinforcementTask from './ReinforcementTask';
import Profile from './Profile';
import AdminPage from './AdminPage';
import './App.css';
import { initSyncSystem, forceSyncWithFirebase, getPendingSyncsCount, recordAnswer } from './utils/syncUtils';
import { 
  fetchQuestionsByCategories, 
  fetchQuestionById, 
  preloadAllCategories 
} from './utils/questionService';
import { 
  storeLearningState, 
  getLearningState, 
  getAllLearningStates,
  initLearningDB,
  getDueQuestions,
  calculateDueCounts,
  forceRefreshDueQuestions
} from './utils/indexedDB';
import NetworkStatus from './components/NetworkStatus';
import NeuralBackground from './components/NeuralBackground';
import { 
  getUserSubscriptionTier, 
  getTierFeatures, 
  checkFeatureLimit, 
  trackDailyUsage,
  getTodayUsage,
  SUBSCRIPTION_TIERS
} from './utils/subscriptionService';

const functions = getFunctions(app);

const normalizeNumber = (input) => {
  const numMap = {
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
    'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14',
    'fifteen': '15', 'sixteen': '16', 'seventeen': '17', 'eighteen': '18', 'nineteen': '19',
    'twenty': '20', 'twenty-one': '21', 'twenty-two': '22', 'twenty-three': '23', 'twenty-four': '24',
    'twenty-five': '25', 'twenty-six': '26', 'twenty-seven': '27', 'twenty-eight': '28', 'twenty-nine': '29',
    'thirty': '30', 'thirty-one': '31', 'thirty-two': '32', 'thirty-three': '33', 'thirty-four': '34',
    'thirty-five': '35', 'thirty-six': '36', 'thirty-seven': '37', 'thirty-eight': '38', 'thirty-nine': '39',
    'forty': '40', 'forty-one': '41', 'forty-two': '42', 'forty-three': '43', 'forty-four': '44',
    'forty-five': '45', 'forty-six': '46', 'forty-seven': '47', 'forty-eight': '48', 'forty-nine': '49',
    'fifty': '50', 'fifty-one': '51', 'fifty-two': '52', 'fifty-three': '53', 'fifty-four': '54',
    'fifty-five': '55', 'fifty-six': '56', 'fifty-seven': '57', 'fifty-eight': '58', 'fifty-nine': '59',
    'sixty': '60', 'sixty-one': '61', 'sixty-two': '62', 'sixty-three': '63', 'sixty-four': '64',
    'sixty-five': '65', 'sixty-six': '66', 'sixty-seven': '67', 'sixty-eight': '68', 'sixty-nine': '69',
    'seventy': '70', 'seventy-one': '71', 'seventy-two': '72', 'seventy-three': '73', 'seventy-four': '74',
    'seventy-five': '75', 'seventy-six': '76', 'seventy-seven': '77', 'seventy-eight': '78', 'seventy-nine': '79',
    'eighty': '80', 'eighty-one': '81', 'eighty-two': '82', 'eighty-three': '83', 'eighty-four': '84',
    'eighty-five': '85', 'eighty-six': '86', 'eighty-seven': '87', 'eighty-eight': '88', 'eighty-nine': '89',
    'ninety': '90', 'ninety-one': '91', 'ninety-two': '92', 'ninety-three': '93', 'ninety-four': '94',
    'ninety-five': '95', 'ninety-six': '96', 'ninety-seven': '97', 'ninety-eight': '98', 'ninety-nine': '99'
  };
  
  // Check if input is a digit (like "2")
  if (!isNaN(Number(input)) && Number(input) >= 0 && Number(input) <= 99) {
    // Convert from digit to word
    const number = Number(input);
    const reversedMap = Object.fromEntries(
      Object.entries(numMap).map(([word, digit]) => [digit, word])
    );
    return reversedMap[String(number)] || input;
  }
  
  // Handle conversion from word to digit (e.g., "two" to "2")
  const lowerInput = input.toLowerCase().replace(/\s+/g, '-');
  return numMap[lowerInput] || input;
};

const normalizeAnswer = (input) => {
  // Handle empty or falsy inputs
  if (!input) return '';
  
  // Normalize numbers (both digits and written form)
  // This handles both converting digits to words and words to digits
  const normalizedNumber = normalizeNumber(input);
  if (normalizedNumber !== input) {
    return normalizedNumber;
  }
  
  // Convert to string, trim, and convert to lowercase
  let normalized = String(input).trim().toLowerCase();
  
  // Replace common contractions
  normalized = normalized.replace(/n't/g, ' not');
  normalized = normalized.replace(/'s/g, ' is');
  normalized = normalized.replace(/'re/g, ' are');
  normalized = normalized.replace(/'m/g, ' am');
  normalized = normalized.replace(/'ve/g, ' have');
  normalized = normalized.replace(/'ll/g, ' will');
  normalized = normalized.replace(/'d/g, ' would');
  
  // Remove punctuation and extra whitespace
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
  normalized = normalized.replace(/\s{2,}/g, ' ');
  
  // Stem words (very simple approach)
  const stemmedWords = normalized.split(' ').map(word => {
    // Remove trailing 's', 'es', 'ed', 'ing'
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    if (word.endsWith('es')) return word.slice(0, -2);
    if (word.endsWith('ed')) return word.slice(0, -2);
    if (word.endsWith('ing')) return word.slice(0, -3);
    return word;
  });
  
  // Sort words alphabetically to handle different word orders
  return stemmedWords.sort().join(' ');
};

function App() {
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [shuffledAnswers, setShuffledAnswers] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [hint, setHint] = useState('');
  const [explanation, setExplanation] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [matchingAnswers, setMatchingAnswers] = useState({});
  const [matchingCorrect, setMatchingCorrect] = useState({});
  const [showReinforcement, setShowReinforcement] = useState(false);
  const [reinforcementInput, setReinforcementInput] = useState('');
  const [userHistory, setUserHistory] = useState({});
  const [user, setUser] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [mode, setMode] = useState(null);
  const [username, setUsername] = useState('');
  const [pendingReinforcement, setPendingReinforcement] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [isSettingUsername, setIsSettingUsername] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [spacedRepetitionEnabled, setSpacedRepetitionEnabled] = useState(false); // Start with spaced repetition off by default
  const [questionPriorities, setQuestionPriorities] = useState({});
  const [dueQuestions, setDueQuestions] = useState([]);
  const [dueQuestionsByCategory, setDueQuestionsByCategory] = useState({});
  const [categories, setCategories] = useState([]);
  const [trainingInProgress, setTrainingInProgress] = useState(false);
  const [currentTrainingState, setCurrentTrainingState] = useState(null);
  const [screen, setScreen] = useState('home');
  const [sessionResults, setSessionResults] = useState({
    totalQuestions: 0,
    correctAnswers: 0,
    accuracy: 0,
    timeSpent: 0
  });
  // Subscription-related state
  const [subscriptionTier, setSubscriptionTier] = useState(SUBSCRIPTION_TIERS.FREE);
  const [tierFeatures, setTierFeatures] = useState(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalMessage, setLimitModalMessage] = useState('');
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
  
  // Refs
  const verificationIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const animationFrameRef = useRef(null);
  const timerEndTimeRef = useRef(null);
  const timerDomNodeRef = useRef(null);
  const vanillaTimerIdRef = useRef(null);
  const timerExpirationHandlingRef = useRef(false);

  const fetchUserHistory = async (uid) => {
    try {
      console.log('Fetching user history for:', uid);
      
      // Fetch subscription tier information
      setIsLoadingSubscription(true);
      const tier = await getUserSubscriptionTier(uid, db);
      const features = getTierFeatures(tier);
      setSubscriptionTier(tier);
      setTierFeatures(features);
      
      // Ensure spaced repetition is disabled for free tier users
      if (!features.spacedRepetition && spacedRepetitionEnabled) {
        console.log('Disabling spaced repetition for free tier user');
        setSpacedRepetitionEnabled(false);
        localStorage.setItem('spacedRepetitionEnabled', 'false');
      }
      
      setIsLoadingSubscription(false);
      
      console.log('User subscription tier:', tier);
      
      // Initialize IndexedDB
      await initLearningDB();
      
      // Get the compressed learning state from Firestore
      const spacedDoc = await getDoc(doc(db, `users/${uid}/data/spaced`));
      const compressedStates = spacedDoc.exists() ? (spacedDoc.data().questionStates || {}) : {};
      console.log('Using compressed learning state format:', Object.keys(compressedStates).length, 'questions');
      
      // Convert compressed states to the format expected by the application
      const history = {};
      
      Object.entries(compressedStates).forEach(([questionId, state]) => {
        // Create attemptsHistory array from binary history string
        const attemptsHistory = [];
        const binaryHistory = state.hist || '';
        const lastReviewTime = state.lrn || Date.now();
        
        // Convert binary history to attempt objects
        for (let i = 0; i < binaryHistory.length; i++) {
          // Simulate timestamps by going backward in time (newest first)
          // Each attempt is roughly 1-7 days apart for simplicity
          const timestamp = new Date(lastReviewTime - (i * 24 * 60 * 60 * 1000));
          
          attemptsHistory.push({
            questionId,
            timestamp: timestamp.toISOString(),
            correct: binaryHistory[i] === '1',
            timeSpent: 0 // We don't have this info in compressed format
          });
        }
        
        history[questionId] = {
          questionId,
          firstSeen: new Date(state.lrn - 30 * 24 * 60 * 60 * 1000).toISOString(), // Estimate
          lastSeen: new Date(state.lrn).toISOString(),
          attemptsHistory
        };
      });

      console.log('Converted compressed states to history format:', Object.keys(history).length, 'questions');
      setUserHistory(history);
      
      // Initialize the sync system
      initSyncSystem(uid, db);
      
      // Pre-calculate due questions and priorities on load
      if (spacedRepetitionEnabled) {
        // Calculate due counts from IndexedDB
        const dueCounts = await calculateDueCounts();
        console.log('Due counts from IndexedDB:', dueCounts);
        
        // Get due questions from IndexedDB
        const due = await getDueQuestions();
        console.log('Due questions from IndexedDB:', due.length);
        
        // Update state with due questions
        const dueQuestionIds = due.map(q => q.qid);
        setDueQuestions(dueQuestionIds);
        
        // Group due questions by category
        const dueByCategory = {};
        due.forEach(q => {
          const category = q.category;
          if (category) {
            if (!dueByCategory[category]) {
              dueByCategory[category] = [];
            }
            dueByCategory[category].push(q.qid);
          }
        });
        
        setDueQuestionsByCategory(dueByCategory);
        console.log('Due questions by category:', dueByCategory);
        
        // Calculate priorities for all questions
        const priorities = {};
        due.forEach(q => {
          priorities[q.qid] = calculateQuestionPriority(history[q.qid]);
        });
        
        setQuestionPriorities(priorities);
      }
    } catch (e) {
      console.error('Error fetching user history:', e);
    }
  };

  const fetchUsernameWithRetry = async (uid, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          return userDoc.data().username || '';
        }
        console.error('User document not found in Firestore for UID:', uid);
        return '';
      } catch (err) {
        console.error(`Error fetching username (attempt ${i + 1}/${retries}):`, err);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw err;
        }
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('onAuthStateChanged triggered, currentUser:', currentUser?.uid, 'isVerifying:', isVerifying, 'awaitingVerification:', awaitingVerification);
      
      // Update user state regardless
      setUser(currentUser);
      
      // Check if user is admin
      if (currentUser && currentUser.uid === 'PRmcNpP6eVXHfsaa6PdaD4pTH3m1') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
      
      // Skip additional processing if we're in special states
      if (isVerifying || awaitingVerification || isSettingUsername) {
        console.log('Skipping auth state processing due to special state');
        return;
      }
      
      if (currentUser) {
        try {
          // Check if the user has a username in Firestore
          console.log("Checking if user has a username in Firestore");
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          
          // If user document doesn't exist or doesn't have a username, redirect to username creation
          if (!userDoc.exists() || !userDoc.data().username) {
            console.log('User needs to set a username');
            setIsSettingUsername(true);
            setShowUsernamePrompt(true);
            setPendingCredentials({ 
              email: currentUser.email, 
              uid: currentUser.uid 
            });
            return;
          }
          
          // User has a username, proceed normally
          console.log("User has a username, proceeding to fetch history");
          await fetchUserHistory(currentUser.uid);
          const fetchedUsername = await fetchUsernameWithRetry(currentUser.uid);
          console.log("Username fetched:", fetchedUsername);
          setUsername(fetchedUsername);
          setMode('training');
        } catch (err) {
          console.error('Error fetching user data:', err);
          if (err.message.includes('Missing or insufficient permissions')) {
            console.log('Permission error, user may need to set username');
            setIsSettingUsername(true);
            setShowUsernamePrompt(true);
            setPendingCredentials({ 
              email: currentUser.email, 
              uid: currentUser.uid 
            });
            return;
          }
          // Default fallback if permission error isn't detected
          setUsername('');
          setMode('training');
        }
      } else {
        setMode(null);
        setUsername('');
      }
    });
    return () => unsubscribe();
  }, [isSettingUsername, isVerifying, awaitingVerification]);

  useEffect(() => {
    if (awaitingVerification && pendingCredentials) {
      setIsVerifying(true);
      const { email, password } = pendingCredentials;

      const checkVerification = async () => {
        try {
          console.log("Checking email verification for:", email);
          // First sign out to ensure clean state
          await signOut(auth);
          
          // Try to sign in
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
          
          // Force reload user data
          await user.reload();
          
          if (user.emailVerified) {
            console.log("Email verified! Proceeding to username setup");
            // First sign out to clear state
            await signOut(auth);
            
            // Clear any previous errors
            setError(null);
            
            // Update state to show username prompt
            setIsVerifying(false);
            setAwaitingVerification(false);
            setIsSettingUsername(true);
            setShowUsernamePrompt(true);
          } else {
            console.log("Email not yet verified");
            await signOut(auth);
            setError("Email not yet verified. Please check your inbox and click the verification link.");
          }
        } catch (err) {
          console.error('Error checking verification:', err);
          if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
            setAwaitingVerification(false);
            setPendingCredentials(null);
            setIsVerifying(false);
            setError('User not found. Please sign up again.');
          }
        }
      };

      // Create ref to store interval ID
      verificationIntervalRef.current = setInterval(checkVerification, 5000);
      
      // Run check immediately
      checkVerification();
      
      return () => {
        if (verificationIntervalRef.current) {
          clearInterval(verificationIntervalRef.current);
          verificationIntervalRef.current = null;
        }
        setIsVerifying(false);
      };
    }
  }, [awaitingVerification, pendingCredentials]);

  useEffect(() => {
    if (!questions || questions.length === 0 || currentQuestionIndex >= questions.length) {
      setShuffledAnswers([]);
      return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion || !currentQuestion.type) {
      setShuffledAnswers([]);
      return;
    }

    setQuestionStartTime(Date.now());

    const ensureOptionsArray = (options) => {
      if (!options) return [];
      if (Array.isArray(options)) return options;
      if (typeof options === 'string') {
        // Only split if the string contains commas, otherwise treat as a single option
        return options.includes(',') ? options.split(',').map(opt => opt.trim()) : [options];
      }
      if (typeof options === 'object') return Object.values(options);
      return [];
    };

    if (currentQuestion.type === 'multiple-choice') {
      const optionsArray = ensureOptionsArray(currentQuestion.options);
      setShuffledAnswers(optionsArray.sort(() => Math.random() - 0.5));
    } else if (currentQuestion.type === 'matching') {
      setMatchingAnswers({});
      setMatchingCorrect({});
      const optionsArray = ensureOptionsArray(currentQuestion.options);
      setShuffledAnswers(optionsArray.sort(() => Math.random() - 0.5));
    } else {
      setShuffledAnswers([]);
    }
  }, [questions, currentQuestionIndex]);

  useEffect(() => {
    // Only provide cleanup function for the timer
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, []); // No dependencies needed for cleanup

  // This function will run when the component mounts to set up the timer DOM node
  useEffect(() => {
    // Create a timer container element to be managed outside of React
    const timerElement = document.createElement('div');
    timerElement.className = 'vanilla-timer';
    timerElement.style.display = 'none';
    document.body.appendChild(timerElement);
    
    // Store a reference to use later
    timerDomNodeRef.current = timerElement;
    
    // Clean up when component unmounts
    return () => {
      if (timerDomNodeRef.current) {
        document.body.removeChild(timerDomNodeRef.current);
        timerDomNodeRef.current = null;
      }
      
      if (vanillaTimerIdRef.current) {
        clearInterval(vanillaTimerIdRef.current);
        vanillaTimerIdRef.current = null;
      }
    };
  }, []);

  // Better timer handling that won't affect input fields
  const startVanillaTimer = (durationInSeconds) => {
    // Clear any existing timer
    if (vanillaTimerIdRef.current) {
      clearInterval(vanillaTimerIdRef.current);
      vanillaTimerIdRef.current = null;
    }
    
    // Get the DOM node
    const timerElement = timerDomNodeRef.current;
    if (!timerElement) return;
    
    // Calculate end time
    const endTime = Date.now() + (durationInSeconds * 1000);
    
    // Reset expired flag
    timerElement.setAttribute('data-expired', 'false');
    
    // Make the timer visible
    timerElement.style.display = 'block';
    
    // Last update timestamp for throttling (update max once per second)
    let lastUpdateTime = 0;
    
    // Update function for the timer
    const updateTimer = () => {
      const now = Date.now();
      
      // Only update once per second to prevent too frequent DOM updates
      if (now - lastUpdateTime < 1000) {
        return;
      }
      
      lastUpdateTime = now;
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      
      // Format the time
      const minutes = Math.floor(remaining / 60);
      const seconds = String(remaining % 60).padStart(2, '0');
      
      // Update the DOM directly - bypassing React
      timerElement.innerHTML = `
        <div class="timer-display">
          <p>Time Remaining: ${minutes}:${seconds}</p>
        </div>
      `;
      
      // Check if timer has expired
      if (remaining <= 0) {
        clearInterval(vanillaTimerIdRef.current);
        vanillaTimerIdRef.current = null;
        
        // Set data attribute to indicate expiration instead of updating React state immediately
        timerElement.setAttribute('data-expired', 'true');
        
        // Change the timer display to indicate expiry
        timerElement.innerHTML = `
          <div class="timer-display expired">
            <p>Time Expired! Complete your current question.</p>
          </div>
        `;
        
        // We don't call setSessionExpired here anymore to avoid React re-rendering
        // It will be checked in handleTrainingSubmit when the user actually submits
      }
    };
    
    // Initial update
    updateTimer();
    
    // Set up the interval using vanilla JS - check more frequently but update display at most once per second
    vanillaTimerIdRef.current = setInterval(updateTimer, 250);
    
    // Store end time for external use if needed
    timerEndTimeRef.current = endTime;
  };

  // Function to stop the vanilla timer
  const stopVanillaTimer = () => {
    if (vanillaTimerIdRef.current) {
      clearInterval(vanillaTimerIdRef.current);
      vanillaTimerIdRef.current = null;
    }
    
    if (timerDomNodeRef.current) {
      timerDomNodeRef.current.style.display = 'none';
    }
    
    timerEndTimeRef.current = null;
  };

  const handleSessionEnd = () => {
    // Stop the vanilla timer
    stopVanillaTimer();
    
    // Cancel any animation frame timer (as backup)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Force sync any pending changes to Firestore, but only if online
    if (user && navigator.onLine) {
      getPendingSyncsCount().then(count => {
        if (count > 0) {
          console.log(`Syncing ${count} pending changes before ending session...`);
          // Create a toast or notification that syncing is happening
          forceSyncWithFirebase(user.uid, db).then(() => {
            console.log('Session end sync completed successfully');
          }).catch(error => {
            console.error('Error syncing at session end:', error);
          });
        }
      });
    } else if (user && !navigator.onLine) {
      console.log('Currently offline - changes will sync when connection is restored');
      // You could add a toast notification here about offline mode
    }
    
    // Calculate session statistics
    const totalAnswered = currentTrainingState?.questionsAnswered || 0;
    const correctAnswers = currentTrainingState?.correctAnswers || 0;
    const accuracyPercent = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    
    // Update the session results for the modal
    setSessionResults({
      totalQuestions: totalAnswered,
      correctAnswers: correctAnswers,
      accuracy: accuracyPercent,
      timeSpent: sessionDuration - (timeRemaining || 0)
    });
    
    // Show completion modal instead of alert
    setShowCompletionModal(true);
    
    // Keep the states as is until user acknowledges the modal
    // The reset will happen in the handleCompletionModalClose function
  };

  // New function to handle closing the completion modal
  const handleCompletionModalClose = () => {
    setShowCompletionModal(false);
    
    // Reset all session-related states
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuestions([]);
    setSelectedCategories([]);
    setSessionDuration(null);
    setTimeRemaining(null);
    setSessionExpired(false);
    setSelectedAnswer(null);
    setAnswered(false);
    setUserInput('');
    setFeedback('');
    setHint('');
    setExplanation('');  // Make sure explanation is cleared
    setAttempts(0);
    setMatchingAnswers({});
    setMatchingCorrect({});
    setShowReinforcement(false);
    setReinforcementInput('');
    setMode('training');
  };

  const calculateDueDate = (history) => {
    // If there's no history at all, treat as due immediately
    if (!history || !history.attemptsHistory || history.attemptsHistory.length === 0) {
      console.log('No history, due immediately');
      return new Date(0); // Due immediately (epoch time)
    }
    
    // Get the most recent attempts
    const sortedAttempts = [...history.attemptsHistory].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    // Start with base calculation
    const lastAttempt = sortedAttempts[0];
    if (!lastAttempt || !lastAttempt.timestamp) {
      console.log('Invalid last attempt, due immediately');
      return new Date(0);
    }
    
    const lastAttemptDate = new Date(lastAttempt.timestamp);
    const wasCorrect = lastAttempt.correct;
    
    // If last attempt was incorrect, due after 1 day
    if (!wasCorrect) {
      const dueDate = new Date(lastAttemptDate.getTime() + 1 * 24 * 60 * 60 * 1000);
      console.log(`Last attempt was incorrect, due after 1 day: ${dueDate.toISOString()}`);
      return dueDate;
    }
    
    // Calculate streak (consecutive correct answers)
    let streak = 0;
    for (let i = 0; i < sortedAttempts.length; i++) {
      if (sortedAttempts[i].correct) {
        streak++;
      } else {
        break;
      }
    }
    
    // Calculate interval based on SM-2 spaced repetition algorithm
    let interval = Math.min(30, Math.pow(2, streak - 1));
    
    // For testing or demonstration purposes, you can temporarily reduce intervals
    // Uncomment for debugging/testing
    // interval = Math.min(interval, 1);  // Force all intervals to be at most 1 day
    
    // Convert interval (days) to milliseconds and add to last attempt date
    const dueDate = new Date(lastAttemptDate.getTime() + interval * 24 * 60 * 60 * 1000);
    console.log(`Streak: ${streak}, interval: ${interval} days, due: ${dueDate.toISOString()}`);
    return dueDate;
  };

  const calculateQuestionPriority = (history, difficultyWeight = 2) => {
    // Default high priority for new questions
    if (!history || !history.attemptsHistory || history.attemptsHistory.length === 0) {
      return 100; // Highest priority for new questions
    }
    
    // Get due date
    const dueDate = calculateDueDate(history);
    const now = new Date();
    
    // Calculate overdue factor (higher priority if more overdue)
    const daysOverdue = (now - dueDate) / (24 * 60 * 60 * 1000);
    const overdueFactor = Math.max(0, daysOverdue * 10); // 10 points per day overdue
    
    // Calculate difficulty factor
    const numAttempts = history.attemptsHistory.length;
    const numCorrect = history.attemptsHistory.filter(a => a.correct).length;
    const errorRate = numAttempts > 0 ? (1 - (numCorrect / numAttempts)) * 100 : 50;
    
    // Calculate recency factor (prioritize questions not seen recently)
    const lastSeenDate = new Date(history.lastSeen);
    const daysSinceLastSeen = (now - lastSeenDate) / (24 * 60 * 60 * 1000);
    const recencyFactor = Math.min(50, daysSinceLastSeen * 2); // 2 points per day, max 50
    
    // Combine factors into a priority score
    let priority = overdueFactor + (errorRate * difficultyWeight) + recencyFactor;
    
    // Special cases
    if (daysOverdue > 0) {
      // Questions that are due or overdue get a minimum priority
      priority = Math.max(priority, 70);
    } else {
      // Questions not yet due get a maximum priority cap
      priority = Math.min(priority, 60);
    }
    
    return priority;
  };

  const fetchQuestions = async (categories) => {
    console.log('Fetching questions for categories:', categories);
    setLoading(true);
    try {
      // If spaced repetition is disabled, use the original approach
      if (!spacedRepetitionEnabled || !user) {
        // Use the new question service
        const fetchedQuestions = await fetchQuestionsByCategories(categories, db);
        
        if (!Array.isArray(fetchedQuestions) || fetchedQuestions.length === 0) {
          console.log('No questions found for categories:', categories);
          setError('No questions available for selected categories.');
          setQuestions([]);
        return;
      }
  
        setQuestions(fetchedQuestions);
        setError(null);
      } else {
        // Enhanced approach with spaced repetition
        console.log('Using spaced repetition algorithm to fetch questions');
        
        // Get due questions from IndexedDB first
        const dueQuestionsData = await getDueQuestions(categories);
        const dueQuestionIds = dueQuestionsData.map(q => q.qid);
        
        // Fetch questions for the due question IDs and regular questions
        const allQuestions = await fetchQuestionsByCategories(categories, db);
        
        if (!Array.isArray(allQuestions) || allQuestions.length === 0) {
        console.log('No questions found for categories:', categories);
        setError('No questions available for selected categories.');
        setQuestions([]);
        return;
      }
  
        // Separate due and non-due questions
        const dueQuestions = allQuestions.filter(q => dueQuestionIds.includes(q.id));
        const nonDueQuestions = allQuestions.filter(q => !dueQuestionIds.includes(q.id));
        
        // Create a combined list with due questions first
        const combinedQuestions = [...dueQuestions];
        
        // Fill up to the max with non-due questions if needed
        const maxQuestions = 100;
        const remainingSlots = maxQuestions - dueQuestions.length;
        
        if (remainingSlots > 0 && nonDueQuestions.length > 0) {
          // Randomly select non-due questions
          const shuffledNonDue = [...nonDueQuestions].sort(() => 0.5 - Math.random());
          const selectedNonDue = shuffledNonDue.slice(0, remainingSlots);
          combinedQuestions.push(...selectedNonDue);
        }
        
        // For logging
        const dueByCategory = {};
        categories.forEach(category => {
          dueByCategory[category] = dueQuestions.filter(q => q.category === category).length;
        });
        
        console.log(`Selected ${dueQuestions.length} due and ${combinedQuestions.length - dueQuestions.length} non-due questions from ${categories.join(', ')}`);
        console.log('Due questions by category:', dueByCategory);
        
        setQuestions(combinedQuestions);
      setError(null);
      }
    } catch (e) {
      console.error('Error fetching questions:', e);
      setError('Failed to fetch questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (emailOrUser, password, username) => {
    console.log("App.js handleSignUp called");
    console.log("Username provided:", username || "None");
    
    try {
      let user;
      let email;
      let uid;
      
      // Google Sign-Up flow - unchanged
      if (typeof emailOrUser === 'object' && emailOrUser.uid) {
        console.log("Google Sign-Up detected, user:", emailOrUser.uid);
        user = emailOrUser;
        email = user.email;
        uid = user.uid;
        if (!username) {
          setError('Username is required');
          return;
        }
        try {
          console.log("Creating user profile with username:", username, "and email:", email);
          const createUser = httpsCallable(functions, 'createUser');
          const result = await createUser({ username: username.trim(), email });
          console.log("Profile creation result:", result);
          setUsername(username.trim());
          setIsSettingUsername(false);
          setShowUsernamePrompt(false);
          setMode('training');
        } catch (profileError) {
          console.error("Error creating user profile:", profileError);
          setError('Failed to create user profile');
          setIsSettingUsername(false);
          return;
        }
      } 
      // Email Sign-Up flow - modified
      else {
        if (!emailOrUser || !password) {
          console.log("Email or password missing");
          setError('Email and password are required');
          return;
        }
        
        const emailStr = typeof emailOrUser === 'string' ? emailOrUser.trim() : String(emailOrUser).trim();
        const passwordStr = typeof password === 'string' ? password.trim() : String(password).trim();
        
        if (emailStr.length === 0 || passwordStr.length === 0) {
          console.log("Empty email or password after trimming");
          setError('Email and password cannot be empty');
          return;
        }
        
        // If username is provided, it means we're in the post-verification username setup phase
        if (username) {
          console.log("Setting username for verified email user:", emailStr);
          try {
            // Make sure we're signed in before creating the profile
            let currentUid;
            if (auth.currentUser) {
              console.log("User already signed in, using current user");
              currentUid = auth.currentUser.uid;
            } else if (pendingCredentials?.uid) {
              console.log("Using uid from pendingCredentials");
              currentUid = pendingCredentials.uid;
              
              // Try to sign in if needed
              if (pendingCredentials.password) {
                console.log("Need to sign in user first");
                const userCredential = await signInWithEmailAndPassword(auth, emailStr, pendingCredentials.password);
                currentUid = userCredential.user.uid;
              }
            } else {
              throw new Error("No user is signed in and no pendingCredentials.uid is available");
            }
            
            console.log("Creating user profile with username:", username, "for uid:", currentUid);
            const createUser = httpsCallable(functions, 'createUser');
            const result = await createUser({ username: username.trim(), email: emailStr });
            console.log("Profile creation result:", result);
            
            // Update local state
            setUsername(username.trim());
            setIsSettingUsername(false);
            setShowUsernamePrompt(false);
            setAwaitingVerification(false);
            setPendingCredentials(null);
            
            // Clear any error that might have been set
            setError(null);
            
            // Redirect to training screen
            setMode('training');
          } catch (profileError) {
            console.error("Error creating user profile:", profileError);
            setError('Failed to create user profile: ' + profileError.message);
            setIsSettingUsername(false);
            return;
          }
        }
        
        // Initial sign up with email/password only
        console.log("Attempting to create user with Firebase auth");
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, emailStr, passwordStr);
          user = userCredential.user;
          email = emailStr;
          uid = user.uid;
          console.log("User created:", user.uid);
          
          console.log("Sending verification email");
          await sendEmailVerification(user);
          console.log('Verification email sent—check your inbox!');
          
          // Sign out to ensure clean state
          await signOut(auth);
          
          // Update state
          setAwaitingVerification(true);
          setPendingCredentials({ email: emailStr, password: passwordStr, uid });
          setError(null);
          return;
        } catch (authError) {
          console.error("Auth error:", authError);
          
          // Provide user-friendly message for email-already-in-use error
          if (authError.code === 'auth/email-already-in-use') {
            setError('This email address is already in use. Please use a different email or try signing in.');
          } else {
            setError('Authentication error: ' + authError.message);
          }
          
          setAwaitingVerification(false);
          setPendingCredentials(null);
          return;
        }
      }

      setError(null);
    } catch (err) {
      console.error("Sign-up error:", err);
      setError(err.message || 'An error occurred during sign up');
      setIsSettingUsername(false);
      setAwaitingVerification(false);
      setPendingCredentials(null);
    }
  };

  const handleSignIn = async (emailOrUser, password) => {
    console.log("App.js handleSignIn called");
    
    try {
      if (typeof emailOrUser === 'object' && emailOrUser.uid) {
        console.log("Google Sign-In detected, user:", emailOrUser.uid);
        setUser(emailOrUser);
        setError(null);
      } else {
        if (!emailOrUser || !password) {
          console.log("Email or password missing");
          setError('Email and password are required');
          return;
        }

        const emailStr = typeof emailOrUser === 'string' ? emailOrUser.trim() : String(emailOrUser).trim();
        const passwordStr = typeof password === 'string' ? password.trim() : String(password).trim();
        
        console.log("Processed email:", emailStr);
        console.log("Processed password length:", passwordStr.length);

        if (emailStr.length === 0 || passwordStr.length === 0) {
          console.log("Empty email or password after trimming");
          setError('Email and password cannot be empty');
          return;
        }

        console.log("Attempting sign in with Firebase auth");
        const userCredential = await signInWithEmailAndPassword(auth, emailStr, passwordStr);
        const user = userCredential.user;
        if (!user.emailVerified) {
          await signOut(auth);
          setAwaitingVerification(true);
          setPendingCredentials({ email: emailStr, password: passwordStr, uid: user.uid });
          setError('Please verify your email before signing in.');
          return;
        }
        console.log("Sign in successful:", user.uid);
        setError(null);
      }
    } catch (err) {
      console.error("Sign-in error:", err);
      
      // Don't show popup-closed-by-user error
      if (err.code === 'auth/popup-closed-by-user') {
        return;
      }
      
      setError(err.message || 'An error occurred during sign in');
    }
  };

  const handleSignOut = () => {
    signOut(auth);
    setQuestions([]);
    setScore(0);
    setCurrentQuestionIndex(0);
    setSelectedCategories([]);
    setMode(null);
    setUsername('');
    setSessionDuration(null);
    setTimeRemaining(null);
  };

  const handleCategorySelect = async (categoryId, limitExceeded, customMessage) => {
    // If this is a limit exceeded click, show the modal directly
    if (limitExceeded) {
      const message = customMessage || `You've reached the limit of ${tierFeatures?.maxCategories} categories for your current subscription tier.`;
      showSubscriptionLimitModal(message);
      return;
    }
    
    // If removing a category, always allow
    if (selectedCategories.includes(categoryId)) {
      setSelectedCategories(prev => prev.filter(id => id !== categoryId));
      return;
    }
    
    // If adding a category, check if we're at the limit
    if (!selectedCategories.includes(categoryId)) {
      const newCount = selectedCategories.length + 1;
      
      // Check category limit
      const { hasAccess, message, limit } = await checkFeatureAccess('maxCategories', newCount);
      
      if (!hasAccess) {
        showSubscriptionLimitModal(message);
        return;
      }
    }
    
    // If within limits, add the category
    setSelectedCategories(prev => [...prev, categoryId]);
  };

  const handleDurationSelect = (duration) => {
    setSelectedDuration(prev => prev === duration ? null : duration);
  };

  const handleToggleSpacedRepetition = async (enabled) => {
    // Check if user has access to spaced repetition
    if (enabled) {
      const { hasAccess, message } = await checkFeatureAccess('spacedRepetition');
      if (!hasAccess) {
        showSubscriptionLimitModal(message);
        return;
      }
    }
    
    setSpacedRepetitionEnabled(enabled);
    
    // Save the preference to localStorage
    localStorage.setItem('spacedRepetitionEnabled', JSON.stringify(enabled));
    
    // If enabling, recalculate due questions and priorities
    if (enabled && user) {
      console.log('Recalculating due questions and priorities');
      
      // Use the cached user history to calculate due questions
      const due = [];
      const priorities = {};
      
      // Default hardcoded categories to use as fallback
      const defaultCategories = [
        { id: 'History', name: 'History' },
        { id: 'Science', name: 'Science' },
        { id: 'Literature', name: 'Literature' },
        { id: 'Geography', name: 'Geography' },
        { id: 'Sports', name: 'Sports' },
        { id: 'Entertainment', name: 'Entertainment' },
        { id: 'Art', name: 'Art' },
        { id: 'Pop Culture', name: 'Pop Culture' },
        { id: 'General Knowledge', name: 'General Knowledge' }
      ];
      
      // Initialize dueByCategory with default categories
      const dueByCategory = {};
      defaultCategories.forEach(category => {
        dueByCategory[category.id] = [];
      });
      
      // First, consider all questions with history as potentially due
      const fetchQuestionsForDueCounts = async () => {
        try {
          // Try to fetch questions from Firestore
          console.log('Fetching all questions to match with history');
          let allQuestions;
          
          try {
            const allQuestionsSnapshot = await getDocs(collection(db, 'questions'));
            allQuestions = [];
            allQuestionsSnapshot.forEach(doc => {
              allQuestions.push({ id: doc.id, ...doc.data() });
            });
            console.log(`Fetched ${allQuestions.length} questions from Firestore`);
            
            // Cache the questions for future use
            try {
              localStorage.setItem('all_questions_cache', JSON.stringify(allQuestions));
            } catch (cacheErr) {
              console.error('Error caching questions:', cacheErr);
            }
          } catch (err) {
            console.error('Error fetching questions from Firestore:', err);
            console.log('Falling back to cached questions');
            // Try to get from cache
            const cachedQuestions = localStorage.getItem('all_questions_cache');
            if (cachedQuestions) {
              allQuestions = JSON.parse(cachedQuestions);
              console.log(`Using ${allQuestions.length} questions from cache`);
    } else {
              allQuestions = [];
              console.log('No cached questions available');
            }
          }
          
          // Create a map of question IDs to categories for faster lookups
          const questionCategories = {};
          allQuestions.forEach(question => {
            if (question.id && question.category) {
              questionCategories[question.id] = question.category;
            }
          });
          
          console.log(`Processing ${Object.keys(userHistory).length} history entries for due calculation`);
          
          // Calculate due status for each question in history
          Object.keys(userHistory).forEach(questionId => {
            const questionHistory = userHistory[questionId];
            
            // Calculate priority for this question
            const priority = calculateQuestionPriority(questionHistory);
            priorities[questionId] = priority;
            
            // Determine if it's due based on calculateDueDate
            const dueDate = calculateDueDate(questionHistory);
            const isDue = new Date() >= dueDate;
            
            // If we have a high priority (over 60) or it's due, add to due list
            const isHighPriority = priority >= 60;
            if (isDue || isHighPriority) {
              due.push(questionId);
              console.log(`Question ${questionId} is due (priority: ${priority})`);
              
              // Look up the category from our question map
              const category = questionCategories[questionId];
              
              // If we found a category and it's in our default list, add the question to that category
              if (category && defaultCategories.some(c => c.id === category)) {
                if (!dueByCategory[category]) {
                  dueByCategory[category] = [];
                }
                dueByCategory[category].push(questionId);
                console.log(`Added question ${questionId} to ${category} due list`);
              } else {
                // For questions without a known category, try to guess based on patterns in the ID
                const possibleCategory = guessCategory(questionId, defaultCategories.map(c => c.id));
                if (possibleCategory) {
                  if (!dueByCategory[possibleCategory]) {
                    dueByCategory[possibleCategory] = [];
                  }
                  dueByCategory[possibleCategory].push(questionId);
                  console.log(`Added question ${questionId} to ${possibleCategory} due list (guessed)`);
                }
              }
            }
          });
          
          // Set state with our calculated values
          setDueQuestions(due);
          setQuestionPriorities(priorities);
          setDueQuestionsByCategory(dueByCategory);
          
          // Log the results
          console.log('Recalculated:', due.length, 'due questions');
          console.log('Due by category:', dueByCategory);
          Object.keys(dueByCategory).forEach(category => {
            console.log(`Category ${category}: ${dueByCategory[category]?.length || 0} due questions`);
          });
          
          // Helper function to guess category from question ID
          function guessCategory(questionId, categories) {
            for (const category of categories) {
              if (questionId.toLowerCase().includes(category.toLowerCase())) {
                return category;
              }
            }
            return null;
          }
        } catch (err) {
          console.error('Error calculating due questions:', err);
        }
      };
      
      fetchQuestionsForDueCounts();
    } else {
      // If disabling, clear due questions and priorities
      setDueQuestions([]);
      setQuestionPriorities({});
      setDueQuestionsByCategory({});
    }
  };

  useEffect(() => {
    // Load spaced repetition preference from localStorage
    const savedPreference = localStorage.getItem('spacedRepetitionEnabled');
    
    if (savedPreference !== null) {
      // If the user's tier allows spaced repetition, use the saved preference
      if (tierFeatures?.spacedRepetition) {
        setSpacedRepetitionEnabled(JSON.parse(savedPreference));
      } else {
        // For users without spaced repetition access, always keep it disabled
        setSpacedRepetitionEnabled(false);
        
        // Update localStorage to match the enforced setting
        localStorage.setItem('spacedRepetitionEnabled', 'false');
      }
    } else if (tierFeatures?.spacedRepetition === false) {
      // For new users without the feature, make sure it's disabled
      setSpacedRepetitionEnabled(false);
      localStorage.setItem('spacedRepetitionEnabled', 'false');
    }
  }, [tierFeatures]);

  const handleStartTraining = async () => {
    if (selectedCategories.length === 0) {
      setError("Please select at least one category");
      return;
    }
    
    // Check if the selected duration is allowed for the user's tier
    if (tierFeatures.maxSessionDuration !== null) {
      if (selectedDuration > tierFeatures.maxSessionDuration) {
        const message = `Your current subscription tier only allows sessions up to ${tierFeatures.maxSessionDuration} minutes.`;
        showSubscriptionLimitModal(message);
        return;
      }
    }
    
    // Check session limit (weekly or daily based on tier)
    if (user) {
      const sessionUsage = await getTodayUsage(user.uid, 'sessions', db);
      const interval = tierFeatures.sessionsInterval || 'day';
      const currentUsage = interval === 'week' ? sessionUsage.weekly : sessionUsage.daily;
      
      const { hasAccess, message } = await checkFeatureAccess('maxSessions', currentUsage + 1);
      
      if (!hasAccess) {
        const limitMessage = interval === 'week' 
          ? `You've reached your limit of ${tierFeatures.maxSessions} sessions per week.` 
          : `You've reached your limit of ${tierFeatures.maxSessions} sessions per day.`;
        showSubscriptionLimitModal(message || limitMessage);
        return;
      }
    }
    
    console.log("handleStartTraining called, setting up training session");
    
    // Convert the selected duration from minutes to seconds
    let durationInSeconds;
    
    // Check if this is the test timer (5 seconds)
    if (selectedDuration === 0.08) {
      durationInSeconds = 5; // 5 seconds for testing
    } else {
      durationInSeconds = selectedDuration * 60; // Normal conversion from minutes to seconds
    }
    
    setSessionDuration(durationInSeconds);
    
    // Set training flags
    setTrainingInProgress(true);
    
    // Check if we're in offline mode
    const isOffline = !navigator.onLine;
    console.log(`Network status: ${isOffline ? 'Offline' : 'Online'}`);
    
    // Set up the session
    setCurrentTrainingState({
      startTime: new Date(),
      duration: durationInSeconds,
      categories: selectedCategories,
      questionsAnswered: 0,
      correctAnswers: 0,
      currentQuestionIndex: 0,
      isOffline: isOffline
    });
    
    // Load questions either from cache or Firestore based on network status
    fetchQuestionsByCategories(selectedCategories, 30, true)
      .then(async questions => {
        if (questions.length === 0) {
          setError('No questions available for the selected categories. Please try different categories or check your internet connection.');
          setTrainingInProgress(false);
          return;
        }
        
        // Check questions limit based on subscription tier
        const maxQuestions = tierFeatures.maxQuestionsPerSession;
        let limitedQuestions = questions;
        
        if (maxQuestions !== null) {
          limitedQuestions = questions.slice(0, maxQuestions);
          
          // Show a notice if we limited the questions
          if (limitedQuestions.length < questions.length) {
            console.log(`Limited questions from ${questions.length} to ${limitedQuestions.length} based on subscription`);
          }
        }
        
        console.log(`Fetched ${limitedQuestions.length} questions, attempting to start training session`);
        setQuestions(limitedQuestions);
        
        // Using React Router for navigation instead of screen state
        console.log("Questions set, navigating to /training");
        // Use navigate from react-router if available
        if (window.location.pathname !== '/training') {
          // Manually navigate to training route
          window.history.pushState({}, '', '/training');
          // Force a re-render
          window.dispatchEvent(new Event('popstate'));
        }
        
        // Track this session in usage stats
        if (user) {
          await trackDailyUsage(user.uid, 'sessions', db);
        }
        
        // Start the vanilla timer with the session duration
        console.log(`Starting timer with duration: ${durationInSeconds} seconds`);
        startVanillaTimer(durationInSeconds);
        
        // Start preloading more questions in the background for better experience
        if (navigator.onLine) {
          preloadAllCategories(selectedCategories);
        }
      })
      .catch(error => {
        console.error('Error fetching questions:', error);
        setError('Failed to load questions. Please try again.');
        setTrainingInProgress(false);
      });
  };

  useEffect(() => {
    // Cleanup function for the timer
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  const handleAnswerSelect = (answer) => {
    if (answered) return;
    setSelectedAnswer(answer);
    setAnswered(true);
  };

  // Update handleTrainingSubmit to check for timer expiration without setState
  const handleTrainingSubmit = async (answer) => {
    // Check if timer has expired but continue processing the current answer
    const hasTimerExpired = timerDomNodeRef.current && 
      timerDomNodeRef.current.getAttribute('data-expired') === 'true';
    
    // If we're already handling timer expiration, don't process again
    if (timerExpirationHandlingRef.current) {
      return;
    }
    
    if (answered) return;
    const currentQuestion = questions[currentQuestionIndex];
    let userAnswer;
    
    // Preserve the answer that was passed in, which comes from DOM elements now
    if (currentQuestion.type === 'true-false' || currentQuestion.type === 'multiple-choice') {
      userAnswer = answer;
    } else if (currentQuestion.type === 'matching') {
      userAnswer = answer;
      if (!userAnswer || Object.keys(userAnswer).length === 0) {
        setFeedback('Please select all answers before submitting!');
        return;
      }
    } else {
      // For text inputs, use the passed value directly - it now comes from an uncontrolled DOM input
      userAnswer = answer;
      
      // Double-check it's not empty
      if (!userAnswer || userAnswer.trim() === '') {
        setFeedback('Come on - at least give it a shot!');
        console.log('Feedback set: Come on - at least give it a shot!');
        return;
      }
    }
  
    if (currentQuestion.type === 'matching') {
      const combinedAnswers = { ...currentQuestion.answer, ...userAnswer };
      const correctPairs = { ...matchingCorrect };
      let allCorrect = true;
  
      Object.keys(currentQuestion.answer).forEach(key => {
        const normalizedUserValue = normalizeAnswer(combinedAnswers[key] || '');
        const normalizedCorrectValue = normalizeAnswer(currentQuestion.answer[key]);
        const isCorrect = normalizedUserValue === normalizedCorrectValue;
        if (isCorrect) correctPairs[key] = true;
        allCorrect = allCorrect && isCorrect;
      });
  
      if (allCorrect) {
        setAnswered(true);
        setFeedback('Correct!');
        setMatchingCorrect(correctPairs);
        await updateHistory(currentQuestion.id, true, userHistory);
        setPendingReinforcement(false);
      } else if (attempts === 0) {
        setAttempts(1);
        setFeedback('Incorrect - Retry the missed ones.');
        setMatchingCorrect(correctPairs);
        setMatchingAnswers(prev => {
          const newAnswers = { ...prev };
          Object.keys(correctPairs).forEach(key => delete newAnswers[key]);
          return newAnswers;
        });
        await updateHistory(currentQuestion.id, false, userHistory);
      } else {
        setAnswered(true);
        setMatchingCorrect(correctPairs);
        const correctText = Object.entries(currentQuestion.answer)
          .map(([key, value]) => `${key} - ${value}`)
          .join(', ');
        setFeedback(`Incorrect, the correct matches are: ${correctText}`);
        await updateHistory(currentQuestion.id, false, userHistory);
        const shouldShowRT = currentQuestion.reinforcementTask && attempts === 1;
        setPendingReinforcement(shouldShowRT);
      }
    } else {
      const normalizedUserAnswer = normalizeAnswer(userAnswer);
      const normalizedCorrectAnswer = normalizeAnswer(currentQuestion.answer);

      // Use similarity checking instead of exact match
      const isCorrect = checkAnswerSimilarity(normalizedUserAnswer, normalizedCorrectAnswer);
  
      if (isCorrect) {
        setAnswered(true);
        setFeedback('Correct!');
        setHint('');
        setExplanation(currentQuestion.explanation || 'No explanation available.');
        await updateHistory(currentQuestion.id, true, userHistory);
        setPendingReinforcement(false);
      } else if (currentQuestion.type === 'true-false') {
        setAnswered(true);
        setFeedback(`Incorrect, the answer is "${currentQuestion.answer}".`);
        setHint('');
        setExplanation(currentQuestion.explanation || 'No explanation available.');
        await updateHistory(currentQuestion.id, false, userHistory);
        setPendingReinforcement(currentQuestion.reinforcementTask);
      } else if (attempts === 0) {
        setAttempts(1);
        setFeedback('Incorrect');
        setHint(currentQuestion.hint || 'No hint available.');
        setExplanation('');
        
        // Keep the user's answer in the input - explicitly set it to ensure it's kept
        setUserInput(userAnswer);
        
        await updateHistory(currentQuestion.id, false, userHistory);
      } else {
        setAnswered(true);
        setFeedback(`Incorrect, the answer is "${currentQuestion.answer}".`);
        setHint('');
        setExplanation('');
        await updateHistory(currentQuestion.id, false, userHistory);
        const shouldShowRT = currentQuestion.reinforcementTask && attempts === 1;
        setPendingReinforcement(shouldShowRT);
      }
    }
    
    // If the timer has expired, handle it only AFTER processing the answer
    if (hasTimerExpired) {
      // Now we can safely set session expired state
      setSessionExpired(true);
      
      // Set flag to prevent multiple handlers
      timerExpirationHandlingRef.current = true;
      
      // Show a timeout message
      setTimeout(() => {
        handleSessionEnd();
        // Reset flag after session end
        timerExpirationHandlingRef.current = false;
      }, 3000); // Give the user 3 seconds to see the result
    }
  };

  const handleMatchingSelect = (key, value) => {
    setMatchingAnswers(prev => ({ ...prev, [key]: value }));
  };

  const updateHistory = async (questionId, isCorrect, history) => {
    const now = new Date().toISOString();
    const timeSpent = questionStartTime ? Math.round((Date.now() - questionStartTime) / 1000) : 0;
    const currentHistory = history[questionId] || { firstSeen: now, lastSeen: now, attemptsHistory: [] };
    
    const updatedAttempts = [
      ...currentHistory.attemptsHistory,
      { timestamp: now, correct: isCorrect, timeSpent }
    ];

    const updatedHistory = {
      ...history,
      [questionId]: {
        firstSeen: currentHistory.firstSeen,
        lastSeen: now,
        attemptsHistory: updatedAttempts
      }
    };
    setUserHistory(updatedHistory);

    try {
      // Get the current question's category
      const currentQuestion = questions.find(q => q.id === questionId);
      const category = currentQuestion ? currentQuestion.category : null;
      
      // Record the answer for batch syncing, using our optimized approach
      // This adds to queue for later syncing and updates IndexedDB locally
      await recordAnswer(questionId, isCorrect, user.uid, db, false, category);
      
      console.log(`Answer recorded locally: Question ${questionId}, Result: ${isCorrect ? 'Correct' : 'Incorrect'}`);
      
      // For incorrect answers, force a refresh of due questions from IndexedDB
      if (!isCorrect && spacedRepetitionEnabled) {
        console.log('Incorrect answer detected, forcing refresh of due questions');
        // Wait a small amount of time for IndexedDB to update
        setTimeout(async () => {
          try {
            const refreshedDueData = await forceRefreshDueQuestions();
            setDueQuestions(refreshedDueData.dueQuestions);
            setDueQuestionsByCategory(refreshedDueData.dueByCategory);
            console.log('Due questions refreshed after incorrect answer');
          } catch (err) {
            console.error('Error refreshing due questions:', err);
          }
        }, 100);
      }
      
      // Determine if we should initiate a sync now (end of session)
      const isSessionEnding = sessionExpired || (currentQuestionIndex === questions.length - 1);
      if (isSessionEnding && navigator.onLine) {
        console.log('End of session or last question - initiating sync');
        // Background this operation so it doesn't block UI
        setTimeout(() => {
          forceSyncWithFirebase(user.uid, db).then(() => {
            console.log('Session-end sync completed');
          }).catch(err => {
            console.error('Session-end sync failed:', err);
          });
        }, 0);
      }
      
      // Update question priorities after submission
      if (spacedRepetitionEnabled) {
        const updatedPriorities = { ...questionPriorities };
        updatedPriorities[questionId] = calculateQuestionPriority(updatedHistory[questionId]);
        setQuestionPriorities(updatedPriorities);
        
        try {
          // Get the category from the current question in memory instead of Firestore
          if (currentQuestion && currentQuestion.category) {
            const category = currentQuestion.category;
            
            // For incorrect answers, always mark as due immediately
            let isDue = false;
            if (!isCorrect) {
              isDue = true;
            } else {
              // For correct answers, calculate due date normally
              const newDueDate = calculateDueDate(updatedHistory[questionId]);
              isDue = new Date() >= newDueDate;
            }
            
            // Update due questions list
            let newDueQuestions = [...dueQuestions];
            let newDueByCategory = { ...dueQuestionsByCategory };
            
            if (isDue && !dueQuestions.includes(questionId)) {
              // Add to due lists
              console.log(`Adding question ${questionId} to due list`);
              newDueQuestions.push(questionId);
              
              // Make sure the category exists in dueByCategory
              if (!newDueByCategory[category]) {
                newDueByCategory[category] = [];
              }
              
              if (!newDueByCategory[category].includes(questionId)) {
                console.log(`Adding question ${questionId} to category ${category} due list`);
                newDueByCategory[category] = [...newDueByCategory[category], questionId];
              }
            } else if (!isDue && dueQuestions.includes(questionId)) {
              // Remove from due lists
              newDueQuestions = newDueQuestions.filter(id => id !== questionId);
              
              if (newDueByCategory[category]) {
                newDueByCategory[category] = newDueByCategory[category].filter(id => id !== questionId);
              }
            }
            
            setDueQuestions(newDueQuestions);
            setDueQuestionsByCategory(newDueByCategory);
            console.log('Updated due questions by category:', newDueByCategory);
          }
        } catch (error) {
          console.error('Error updating due questions after submission:', error);
        }
      }
    } catch (error) {
      console.error('Error recording answer:', error);
    }
    
    // If we're in offline mode, show a toast or notification
    if (!navigator.onLine) {
      console.log('Answer recorded offline - will sync when back online');
      // You could add a toast notification here
    }
  };

  const completeReinforcementAndAdvance = (directInput) => {
    // Check if the session has expired
    if (sessionExpired) {
      handleSessionEnd();
      return;
    }
    
    const currentQuestion = questions[currentQuestionIndex];
    // Use the direct input if provided, otherwise fall back to state
    const inputToCheck = directInput || reinforcementInput;
    const normalizedInput = normalizeAnswer(inputToCheck);
    const normalizedAnswer = normalizeAnswer(currentQuestion.answer);

    if (normalizedInput === normalizedAnswer) {
      setShowReinforcement(false);
      setReinforcementInput('');
      setFeedback('');
      setSelectedAnswer(null);
      setAnswered(false);
      setUserInput('');
      setHint('');
      setExplanation('');  // Make sure explanation is cleared
      setAttempts(0);
      setMatchingAnswers({});
      setMatchingCorrect({});

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        console.log('Reinforcement completed, moving to next question:', currentQuestionIndex + 1);
      } else {
        // Call handleSessionEnd instead of duplicating its functionality
        handleSessionEnd();
      }
    } else {
      setFeedback('Try again!');
    }
  };

  const handleNextQuestion = () => {
    // If the session has expired, end it after the current question
    if (sessionExpired) {
      handleSessionEnd();
      return;
    }

    if (pendingReinforcement) {
      setShowReinforcement(true);
      setPendingReinforcement(false);
      setFeedback('');
      return;
    }

    setSelectedAnswer(null);
    setAnswered(false);
    setUserInput('');
    setFeedback('');
    setHint('');
    setExplanation('');
    setAttempts(0);
    setMatchingAnswers({});
    setMatchingCorrect({});
    setShowReinforcement(false);
    setReinforcementInput('');
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Call handleSessionEnd instead of duplicating its functionality
      handleSessionEnd();
    }
  };

  const handleAbandonQuiz = () => {
    // Stop the vanilla timer
    stopVanillaTimer();
    
    // Cancel any animation frame timer (as backup)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Force sync any pending changes to Firestore
    if (user && getPendingSyncsCount() > 0) {
      console.log('Syncing pending changes before abandoning session...');
      forceSyncWithFirebase(user.uid, db);
    }
    
    // Reset session states
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuestions([]);
    setSelectedCategories([]);
    setSessionDuration(null);
    setTimeRemaining(null);
    setSessionExpired(false);
    setSelectedAnswer(null);
    setAnswered(false);
    setUserInput('');
    setFeedback('');
    setHint('');
    setExplanation('');
    setAttempts(0);
    setMatchingAnswers({});
    setMatchingCorrect({});
    setShowReinforcement(false);
    setReinforcementInput('');
    
    setMode(null);
  };

  const handleResendVerificationEmail = async () => {
    if (!pendingCredentials || !pendingCredentials.email || !pendingCredentials.password) {
      setError("Unable to resend verification email. Please try signing in again.");
      return;
    }
    
    try {
      console.log("Attempting to resend verification email");
      const userCredential = await signInWithEmailAndPassword(
        auth,
        pendingCredentials.email,
        pendingCredentials.password
      );
      
      await sendEmailVerification(userCredential.user);
      
      // Clear any previous errors
      setError(null);
      
      // Show success message
      setVerificationMessage("Verification email resent. Please check your inbox.");
      
      // Clear the success message after 5 seconds
      setTimeout(() => {
        setVerificationMessage(null);
      }, 5000);
      
    } catch (error) {
      console.error("Failed to resend verification email:", error);
      
      // Handle too many requests error specifically
      if (error.code === "auth/too-many-requests") {
        setError("You've requested too many emails recently. Please wait a few minutes before trying again.");
      } else {
        setError(`Failed to resend verification email: ${error.message}`);
      }
    }
  };

  const handleAdminClick = () => {
    // setCurrentScreen('admin');
  };

  // Create a PrivateRoute component to protect routes that require authentication
  const PrivateRoute = ({ children }) => {
    return user ? children : <Navigate to="/" />;
  };

  // Create an AdminRoute component to protect admin routes
  const AdminRoute = ({ children }) => {
    return isAdmin ? children : <Navigate to="/training" />;
  };

  // CompletionModal component
  const CompletionModal = () => {
    if (!showCompletionModal) return null;
    
    return (
      <div className="modal-overlay">
        <div className="completion-modal">
          <h2>Training Session Complete!</h2>
          <p>Congratulations! You've completed your training session.</p>
          <button onClick={handleCompletionModalClose}>
            Return to Categories
          </button>
        </div>
      </div>
    );
  };

  const handleLogoClick = () => {
    // Reset training state without showing completion modal
    setMode('training');
    setQuestions([]);
    setSelectedCategories([]);
    setCurrentQuestionIndex(0);
    setScore(0);
    setSessionDuration(null);
    setTimeRemaining(null);
    // Ensure completion modal is hidden when returning to categories
    setShowCompletionModal(false);
  };

  // Add this new function near normalizeAnswer:
  const checkAnswerSimilarity = (userAnswer, correctAnswer) => {
    // If answers are exactly the same after normalization, they match
    if (userAnswer === correctAnswer) return true;
    
    // If answers have no words, comparison is invalid
    if (!userAnswer || !correctAnswer) return false;
    
    // Split into arrays of words for comparison
    const userWords = userAnswer.split(' ').filter(w => w.length > 0);
    const correctWords = correctAnswer.split(' ').filter(w => w.length > 0);
    
    // Calculate what percentage of correct words are found in user answer
    const matchingWords = correctWords.filter(word => userWords.includes(word));
    const matchPercentage = matchingWords.length / correctWords.length;
    
    // Consider it correct if user provided at least 75% of the expected words
    return matchPercentage >= 0.75;
  };

  // Add an effect to fetch categories when the app loads
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        console.log('Fetching categories from Firestore...');
        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        const categoriesData = [];
        categoriesSnapshot.forEach(doc => {
          categoriesData.push({ id: doc.id, name: doc.data().name });
        });
        
        console.log('Retrieved categories:', categoriesData);
        
        if (categoriesData.length === 0) {
          console.log('No categories found in Firestore, using fallback categories');
          // Use fallback categories if none found in Firestore
          const fallbackCategories = [
            { id: 'History', name: 'History' },
            { id: 'Science', name: 'Science' },
            { id: 'Literature', name: 'Literature' },
            { id: 'Geography', name: 'Geography' },
            { id: 'Sports', name: 'Sports' },
            { id: 'Entertainment', name: 'Entertainment' },
            { id: 'Art', name: 'Art' },
            { id: 'Pop Culture', name: 'Pop Culture' },
            { id: 'General Knowledge', name: 'General Knowledge' }
          ];
          setCategories(fallbackCategories);
        } else {
          setCategories(categoriesData);
        }
        
        // Preload all categories in the background if we have a user
        if (user && navigator.onLine) {
          try {
            console.log('Preloading questions for categories...');
            const categoryIds = categoriesData.map(cat => cat.id);
            preloadAllCategories(categoryIds);
          } catch (preloadError) {
            console.error('Error preloading categories:', preloadError);
          }
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        
        // Use fallback categories if there's an error
        const fallbackCategories = [
          { id: 'History', name: 'History' },
          { id: 'Science', name: 'Science' },
          { id: 'Literature', name: 'Literature' },
          { id: 'Geography', name: 'Geography' },
          { id: 'Sports', name: 'Sports' },
          { id: 'Entertainment', name: 'Entertainment' },
          { id: 'Art', name: 'Art' },
          { id: 'Pop Culture', name: 'Pop Culture' },
          { id: 'General Knowledge', name: 'General Knowledge' }
        ];
        setCategories(fallbackCategories);
      }
    };
    
    fetchCategories();
  }, [user, db]);

  // Add an effect to log category information when it changes
  useEffect(() => {
    console.log('=== Categories State Changed ===');
    console.log('Categories:', categories);
    console.log('DueByCategory:', dueQuestionsByCategory);
    console.log('DueQuestions count:', dueQuestions.length);
    
    // Count total due questions by category
    const totalDue = Object.values(dueQuestionsByCategory).reduce(
      (sum, list) => sum + list.length, 0
    );
    console.log('Total due from dueByCategory:', totalDue);
    
    // Check if categories match dueByCategory keys
    const categoryIds = categories.map(c => c.id);
    const dueCategories = Object.keys(dueQuestionsByCategory);
    
    console.log('Category IDs:', categoryIds);
    console.log('Due category keys:', dueCategories);
    
    const mismatchedCategories = dueCategories.filter(id => !categoryIds.includes(id));
    if (mismatchedCategories.length > 0) {
      console.warn('Mismatched categories between categories and dueByCategory:', mismatchedCategories);
    }
  }, [categories, dueQuestionsByCategory, dueQuestions]);

  // Debug function to test sync functionality
  const debugSyncStatus = async () => {
    if (!user) {
      console.log('No user logged in');
      return;
    }
    
    console.log('-------- SYNC DEBUG INFO --------');
    console.log('Pending syncs:', getPendingSyncsCount());
    
    try {
      // Get compressed learning state from Firestore
      const spacedDoc = await getDoc(doc(db, `users/${user.uid}/data/spaced`));
      if (spacedDoc.exists()) {
        const data = spacedDoc.data();
        const questionStates = data.questionStates || {};
        console.log('Stored question states:', Object.keys(questionStates).length);
        
        // Show example of compressed state if available
        if (Object.keys(questionStates).length > 0) {
          const exampleKey = Object.keys(questionStates)[0];
          console.log('Example compressed state:');
          console.log(questionStates[exampleKey]);
          
          // Calculate next review date
          const nextReview = new Date(questionStates[exampleKey].due);
          console.log('Next review date:', nextReview.toLocaleString());
        }
        
        // Show last sync time
        if (data.syncTime) {
          console.log('Last sync time:', new Date(data.syncTime).toLocaleString());
        }
      } else {
        console.log('No spaced repetition data found');
      }
    } catch (error) {
      console.error('Error accessing spaced repetition data:', error);
    }
    console.log('-------------------------------');
  };

  // Call debug function on component mount if in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && user) {
      // Wait a bit for user data to load
      const timer = setTimeout(() => {
        console.log('Running sync debug...');
        debugSyncStatus();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Function to load due questions for review
  const loadDueQuestionsForReview = async () => {
    if (!user) {
      setError('You must be logged in to review questions');
      return;
    }

    try {
      setLoading(true);
      
      // Get questions that are due for review from IndexedDB
      const dueQuestions = await getDueQuestions();
      
      if (dueQuestions.length === 0) {
        setError('No questions are due for review at this time.');
        setLoading(false);
        return;
      }
      
      console.log(`Found ${dueQuestions.length} questions due for review`);
      
      // Fetch the full question details for each due question
      const questionPromises = dueQuestions.map(dueItem => 
        fetchQuestionById(dueItem.questionId)
      );
      
      // Wait for all questions to be fetched
      const fetchedQuestions = await Promise.all(questionPromises);
      
      // Filter out any null results (questions that couldn't be fetched)
      const validQuestions = fetchedQuestions.filter(q => q !== null);
      
      if (validQuestions.length === 0) {
        setError('Could not load any review questions. Please try again later.');
        setLoading(false);
        return;
      }
      
      // Start a review session with these questions
      setQuestions(validQuestions);
      setCurrentTrainingState({
        startTime: new Date(),
        duration: 1800, // 30 minutes for review sessions
        isReviewMode: true,
        questionsAnswered: 0,
        correctAnswers: 0,
        currentQuestionIndex: 0
      });
      
      setTrainingInProgress(true);
      setScreen('question');
      setLoading(false);
    } catch (error) {
      console.error('Error loading review questions:', error);
      setError('Failed to load review questions. Please try again.');
      setLoading(false);
    }
  };

  // Setup and handle background sync during idle time
  useEffect(() => {
    // Only set up idle sync if user is logged in
    if (!user || !db) return;
    
    // Function to request background sync when browser is idle
    const requestIdleSync = () => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(async () => {
          // Check if there are pending syncs and user is online
          if (navigator.onLine) {
            const pendingSyncs = await getPendingSyncsCount();
            if (pendingSyncs > 0) {
              console.log(`Performing background sync of ${pendingSyncs} changes during idle time`);
              await forceSyncWithFirebase(user.uid, db);
            }
          }
          // Schedule next idle check
          setTimeout(requestIdleSync, 5 * 60 * 1000); // Check every 5 minutes
        }, { timeout: 10000 });
      }
    };
    
    // Function to sync when tab becomes hidden (user switches tabs/minimizes)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden' && navigator.onLine) {
        const pendingSyncs = await getPendingSyncsCount();
        if (pendingSyncs > 0) {
          console.log(`Syncing ${pendingSyncs} changes on tab hide`);
          await forceSyncWithFirebase(user.uid, db);
        }
      }
    };
    
    // Initialize the sync system
    initSyncSystem(user.uid, db);
    
    // Start idle sync checks
    requestIdleSync();
    
    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Add a periodic sync check (every 30 minutes)
    const periodicSyncInterval = setInterval(async () => {
      if (navigator.onLine) {
        const pendingSyncs = await getPendingSyncsCount();
        if (pendingSyncs > 0) {
          console.log(`Performing periodic sync of ${pendingSyncs} changes`);
          await forceSyncWithFirebase(user.uid, db);
        }
      }
    }, 30 * 60 * 1000); // 30 minutes
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(periodicSyncInterval);
    };
  }, [user, db]);

  // Add helper function to check feature access
  const checkFeatureAccess = async (featureName, currentValue) => {
    if (!user) return { hasAccess: false, message: 'Please sign in to access this feature' };
    
    // Different handling for boolean features vs. limit-based features
    if (typeof tierFeatures[featureName] === 'boolean') {
      const hasAccess = tierFeatures[featureName];
      return { 
        hasAccess, 
        message: hasAccess ? null : `The ${featureName} feature is only available with a premium subscription.`
      };
    } else {
      // For limit-based features
      const { hasReachedLimit, limit } = await checkFeatureLimit(
        user.uid, 
        featureName, 
        currentValue, 
        db
      );
      
      return {
        hasAccess: !hasReachedLimit,
        message: hasReachedLimit ? 
          `You've reached the limit of ${limit} ${featureName} for your current subscription tier.` : 
          null,
        limit
      };
    }
  };

  // Add a function to show limit modal
  const showSubscriptionLimitModal = (message) => {
    setLimitModalMessage(message);
    setShowLimitModal(true);
  };

  // Create a modal component to show subscription limit notices
  const SubscriptionLimitModal = () => {
    if (!showLimitModal) return null;
    
    return (
      <div className="modal-overlay">
        <div className="limit-modal">
          <div className="modal-header">
            <h2>Subscription Limit Reached</h2>
            <button className="close-button" onClick={() => setShowLimitModal(false)}>×</button>
          </div>
          <div className="modal-content">
            <p>{limitModalMessage}</p>
            <p>Upgrade your subscription to access more features and higher limits.</p>
          </div>
          <div className="modal-footer">
            <button 
              className="secondary-button" 
              onClick={() => setShowLimitModal(false)}
            >
              Cancel
            </button>
            <button 
              className="primary-button" 
              onClick={() => {
                setShowLimitModal(false);
                window.history.pushState({}, '', '/profile');
                window.dispatchEvent(new Event('popstate'));
              }}
            >
              View Subscription Options
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (awaitingVerification || isVerifying) {
    return (
      <div className="verification-screen">
        <h2>Verify Your Email</h2>
        <div className="verification-message">
          <p>Please check your email and click the verification link.</p>
          <p>Once you've verified your email, you will be asked to create a username.</p>
          <p>If you do not see the email, please check your spam folder. You can request a new email to be sent after 5 minutes.</p>
          {error && <div className="error-message">{error}</div>}
          {verificationMessage && <div className="success-message">{verificationMessage}</div>}
          <button 
            className="check-verification-button"
            onClick={async () => {
              try {
                console.log("Manually checking if email has been verified");
                if (!pendingCredentials?.email || !pendingCredentials?.password) {
                  setError('Missing credentials for verification. Please try signing up again.');
                  return;
                }
                
                // Try to sign in
                const userCredential = await signInWithEmailAndPassword(auth, pendingCredentials.email, pendingCredentials.password);
                const user = userCredential.user;
                
                // Force reload to get fresh verification status
                await user.reload();
                
                if (user.emailVerified) {
                  console.log("Email verified! Proceeding to username setup");
                  // First sign out to clear state
                  await signOut(auth);
                  
                  // Clear any previous errors
                  setError(null);
                  
                  // Update state to show username prompt
                  setIsVerifying(false);
                  setAwaitingVerification(false);
                  setIsSettingUsername(true);
                  setShowUsernamePrompt(true);
                } else {
                  console.log("Email not yet verified");
                  await signOut(auth);
                  setError("Email not yet verified. Please check your inbox and click the verification link.");
                }
              } catch (err) {
                console.error('Error checking verification status:', err);
                setError(`Failed to check verification status: ${err.message}`);
              }
            }}
          >
            I've Verified My Email
          </button>
          
          <button 
            className="resend-email-button"
            onClick={handleResendVerificationEmail}
          >
            Resend Email
          </button>
        </div>
      </div>
    );
  }

  if (!user || isSettingUsername) {
    return (
      <LandingPage 
        onSignIn={handleSignIn} 
        onSignUp={handleSignUp} 
        error={error} 
        setIsSettingUsername={setIsSettingUsername}
        showUsernamePrompt={showUsernamePrompt}
        pendingCredentials={pendingCredentials}
      />
    );
  }

  return (
    <div className="App">
      <NeuralBackground />
      <NetworkStatus />
      <Header 
        user={user}
        username={username}
        onSignOut={handleSignOut}
        onLogoClick={handleLogoClick}
        onProfileClick={() => {/* setCurrentScreen('profile') */}}
        onAdminClick={handleAdminClick}
        isAdmin={isAdmin}
      />
      <div className="app-content">
        {loading ? (
          <div>Loading questions...</div>
        ) : error ? (
          <div>{error}</div>
        ) : (
          <Routes>
            <Route path="/" element={
              <CategorySelection
                mode="training"
                categories={categories}
                selectedCategories={selectedCategories}
                onCategorySelect={handleCategorySelect}
                onStart={handleStartTraining}
                error={error}
                selectedDuration={selectedDuration}
                onDurationSelect={handleDurationSelect}
                spacedRepetitionEnabled={spacedRepetitionEnabled}
                onToggleSpacedRepetition={handleToggleSpacedRepetition}
                dueQuestions={dueQuestions}
                questionPriorities={questionPriorities}
                dueQuestionsByCategory={dueQuestionsByCategory}
                isAdmin={isAdmin}
                subscriptionTier={subscriptionTier}
                tierFeatures={tierFeatures}
              />
            } />
            <Route path="/profile" element={
              <PrivateRoute>
                <Profile 
                  user={user} 
                  username={username} 
                  onSignOut={handleSignOut} 
                  onAdminClick={handleAdminClick}
                  isAdmin={isAdmin}
                  debugSyncStatus={debugSyncStatus}
                />
              </PrivateRoute>
            } />
            <Route path="/admin" element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            } />
            <Route path="/training" element={
              <PrivateRoute>
                {questions.length === 0 ? (
                  <CategorySelection
                    mode="training"
                    categories={categories}
                    selectedCategories={selectedCategories}
                    onCategorySelect={handleCategorySelect}
                    onStart={handleStartTraining}
                    error={error}
                    selectedDuration={selectedDuration}
                    onDurationSelect={handleDurationSelect}
                    spacedRepetitionEnabled={spacedRepetitionEnabled}
                    onToggleSpacedRepetition={handleToggleSpacedRepetition}
                    dueQuestions={dueQuestions}
                    questionPriorities={questionPriorities}
                    dueQuestionsByCategory={dueQuestionsByCategory}
                    isAdmin={isAdmin}
                    subscriptionTier={subscriptionTier}
                    tierFeatures={tierFeatures}
                  />
                ) : showReinforcement ? (
                  <ReinforcementTask
                    currentQuestion={questions[currentQuestionIndex]}
                    reinforcementInput={reinforcementInput}
                    setReinforcementInput={setReinforcementInput}
                    feedback={feedback}
                    onSubmit={completeReinforcementAndAdvance}
                  />
                ) : (
                  <QuestionScreen
                    mode={mode}
                    currentQuestion={questions[currentQuestionIndex]}
                    currentQuestionIndex={currentQuestionIndex}
                    questionsLength={questions.length}
                    score={score}
                    selectedAnswer={selectedAnswer}
                    answered={answered}
                    shuffledAnswers={shuffledAnswers}
                    userInput={userInput}
                    feedback={feedback}
                    hint={hint}
                    explanation={explanation}
                    attempts={attempts}
                    matchingAnswers={matchingAnswers}
                    matchingCorrect={matchingCorrect}
                    categoryName={
                      selectedCategories.length === categories.length 
                        ? 'All Categories' 
                        : selectedCategories.map(id => categories.find(cat => cat.id === id)?.name).join(', ')
                    }
                    pendingReinforcement={pendingReinforcement}
                    timeRemaining={timeRemaining}
                    sessionDuration={sessionDuration}
                    onAnswerSelect={handleAnswerSelect}
                    onTrainingSubmit={handleTrainingSubmit}
                    onMatchingSelect={handleMatchingSelect}
                    setUserInput={setUserInput}
                    onNextQuestion={handleNextQuestion}
                    onAbandonQuiz={handleAbandonQuiz}
                    spacedRepetitionEnabled={spacedRepetitionEnabled}
                    dueQuestions={dueQuestions}
                    questionPriorities={questionPriorities}
                    userHistory={userHistory}
                    subscriptionTier={subscriptionTier}
                  />
                )}
              </PrivateRoute>
            } />
          </Routes>
        )}
      </div>
      
      {/* Render the completion modal */}
      <CompletionModal />
      <SubscriptionLimitModal />
    </div>
  );
}

export default App;