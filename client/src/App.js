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
  const lowerInput = input.toLowerCase().replace(/\s+/g, '-');
  return numMap[lowerInput] || input;
};

const normalizeAnswer = (input) => {
  if (!input) return '';
  
  // First apply existing normalization (number words, accents, punctuation, case)
  const normalizedInput = normalizeNumber(
    input
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .toLowerCase()
      .trim()
  );
  
  // Split into words for more flexible comparisons
  const words = normalizedInput.split(/\s+/);
  
  // Remove common filler words that don't affect meaning
  const filteredWords = words.filter(word => 
    !['a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with'].includes(word)
  );
  
  // Handle singular/plural variations by stemming words to their root
  const stemmedWords = filteredWords.map(word => {
    // Basic stemming rules for English
    if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) {
      return word.slice(0, -1); // Remove trailing 's'
    }
    if (word.endsWith('es') && word.length > 4) {
      return word.slice(0, -2); // Remove trailing 'es'
    }
    if (word.endsWith('ies') && word.length > 4) {
      return word.slice(0, -3) + 'y'; // Change 'ies' to 'y'
    }
    return word;
  });
  
  // Sort words alphabetically to handle different word orders
  return stemmedWords.sort().join(' ');
};

const trainingCategories = [
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
  
  // Refs
  const verificationIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const animationFrameRef = useRef(null);
  const timerEndTimeRef = useRef(null);
  const timerDomNodeRef = useRef(null);
  const vanillaTimerIdRef = useRef(null);
  const timerExpirationHandlingRef = useRef(false);

  const fetchUserHistory = async (uid) => {
    if (!auth.currentUser) {
      console.log('No authenticated user, skipping fetchUserHistory');
      setUserHistory({});
      return;
    }
    try {
      const progressSnapshot = await getDocs(collection(db, `userProgress/${uid}/progress`));
      const attemptsSnapshot = await getDocs(collection(db, `userProgress/${uid}/attempts`));
      const history = {};
      const attemptsMap = {};

      attemptsSnapshot.forEach(doc => {
        const data = doc.data();
        attemptsMap[data.progressId] = attemptsMap[data.progressId] || [];
        attemptsMap[data.progressId].push({
          timestamp: data.timestamp,
          correct: data.correct
        });
      });

      progressSnapshot.forEach(doc => {
        const data = doc.data();
        history[data.questionId] = {
          firstSeen: data.firstSeen,
          lastSeen: data.lastSeen,
          attemptsHistory: attemptsMap[data.progressId] || []
        };
      });

      setUserHistory(history);
      console.log('User history loaded from Firestore:', history);
    } catch (e) {
      console.error('Error fetching user history:', e);
      setUserHistory({});
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
      if (typeof options === 'string') return options.split(',').map(opt => opt.trim());
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

  const fetchQuestions = async (categories) => {
    console.log('Fetching questions for categories:', categories);
    setLoading(true);
    try {
      const cacheKey = `questions_${categories.join(',')}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const fetchedQuestions = JSON.parse(cached);
        console.log('Loaded from cache:', fetchedQuestions);
        setQuestions(fetchedQuestions);
        setError(null);
        setLoading(false);
        return;
      }
  
      const getQuestions = httpsCallable(functions, 'getQuestions');
      const result = await getQuestions({ categories, maxQuestions: 200 });
      const fetchedQuestions = result.data.data;
      console.log('Received questions from cloud function:', fetchedQuestions);
  
      if (!Array.isArray(fetchedQuestions) || fetchedQuestions.length === 0) {
        console.log('No questions found for categories:', categories);
        setError('No questions available for selected categories.');
        setQuestions([]);
        return;
      }
  
      localStorage.setItem(cacheKey, JSON.stringify(fetchedQuestions));
      setQuestions(fetchedQuestions);
      setError(null);
    } catch (e) {
      console.error('Error fetching questions:', e.message);
      setError(e.message === 'Rate limit exceeded. Please try again later.'
        ? 'Rate limit exceeded. Please wait a minute.'
        : 'Failed to load questions');
      setQuestions([]);
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

  const handleCategorySelect = (categoryId) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId) 
        : [...prev, categoryId]
    );
  };

  const handleDurationSelect = (duration) => {
    setSelectedDuration(prev => prev === duration ? null : duration);
  };

  const handleStartTraining = (duration) => {
    if (selectedCategories.length > 0) {
      // Special case for the 5-second test timer (0.08 minutes)
      const durationInSeconds = duration === 0.08 
        ? 5  // 5 seconds for testing
        : duration * 60;  // Regular conversion from minutes to seconds
        
      // Clear any existing animation frame timer
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Store the session duration in state (used for other UI elements)
      setSessionDuration(durationInSeconds);
      
      // Initialize with full duration (only used for initial state, not for updates)
      setTimeRemaining(durationInSeconds);
      
      // Reset all question-related state before starting a new session
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
      
      // Start the vanilla JS timer which bypasses React rendering
      startVanillaTimer(durationInSeconds);
      
      // Fetch questions
      fetchQuestions(selectedCategories);
    } else {
      setError('Pick at least one category to start training!');
    }
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
      const progressQuery = await getDocs(collection(db, `userProgress/${user.uid}/progress`));
      let progressId = null;
      progressQuery.forEach(doc => {
        if (doc.data().questionId === questionId) {
          progressId = doc.data().progressId;
        }
      });

      if (!progressId) {
        const progressDoc = await addDoc(collection(db, `userProgress/${user.uid}/progress`), {
          progressId: Date.now(),
          questionId,
          firstSeen: currentHistory.firstSeen,
          lastSeen: now
        });
        progressId = (await getDoc(progressDoc)).data().progressId;
      } else {
        await setDoc(doc(db, `userProgress/${user.uid}/progress`, String(progressId)), {
          progressId,
          questionId,
          firstSeen: currentHistory.firstSeen,
          lastSeen: now
        });
      }

      await addDoc(collection(db, `userProgress/${user.uid}/attempts`), {
        attemptId: Date.now(),
        progressId,
        timestamp: now,
        correct: isCorrect,
        timeSpent
      });

      console.log(`History updated for q${questionId} with timeSpent: ${timeSpent}s`);
    } catch (e) {
      console.error('Error updating history:', e);
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
    
    // Reset all state
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setScore(0);
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
    setSelectedCategories([]);
    setSessionDuration(null);
    setTimeRemaining(null);
    setSessionExpired(false);
    setMode('training');
    // Don't show completion modal when abandoning
    setShowCompletionModal(false);
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
                categories={trainingCategories}
                selectedCategories={selectedCategories}
                onCategorySelect={handleCategorySelect}
                onStart={handleStartTraining}
                error={error}
                selectedDuration={selectedDuration}
                onDurationSelect={handleDurationSelect}
              />
            } />
            <Route path="/profile" element={
              <PrivateRoute>
                <Profile user={user} username={username} onSignOut={handleSignOut} />
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
                    categories={trainingCategories}
                    selectedCategories={selectedCategories}
                    onCategorySelect={handleCategorySelect}
                    onStart={handleStartTraining}
                    error={error}
                    selectedDuration={selectedDuration}
                    onDurationSelect={handleDurationSelect}
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
                      selectedCategories.length === trainingCategories.length 
                        ? 'All Categories' 
                        : selectedCategories.map(id => trainingCategories.find(cat => cat.id === id)?.name).join(', ')
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
                  />
                )}
              </PrivateRoute>
            } />
          </Routes>
        )}
      </div>
      
      {/* Render the completion modal */}
      <CompletionModal />
    </div>
  );
}

export default App;