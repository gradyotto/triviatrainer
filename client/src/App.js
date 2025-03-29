import React, { useState, useEffect } from 'react';
import { auth, db, app } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendEmailVerification } from 'firebase/auth';
import { collection, getDocs, doc, addDoc, getDoc, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import LandingPage from './LandingPage';
import Header from './Header';
import CategorySelection from './CategorySelection';
import QuestionScreen from './QuestionScreen';
import ReinforcementTask from './ReinforcementTask';
import Profile from './Profile';
import './App.css';

const functions = getFunctions(app);

// Normalization functions
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
  return normalizeNumber(
    input
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .toLowerCase()
      .trim()
  );
};

const normalizeOptions = (options) => {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  if (typeof options === 'string') return options.split(',').map(opt => opt.trim());
  return [];
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [mode, setMode] = useState(null);
  const [username, setUsername] = useState('');
  const [currentScreen, setCurrentScreen] = useState('main');
  const [pendingReinforcement, setPendingReinforcement] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(null); // In seconds
  const [timeRemaining, setTimeRemaining] = useState(null); // In seconds
  const [questionStartTime, setQuestionStartTime] = useState(null); // For tracking

  const fetchUserHistory = async (uid) => {
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchUserHistory(currentUser.uid);
        getDoc(doc(db, 'users', currentUser.uid)).then(userDoc => {
          if (userDoc.exists()) {
            setUsername(userDoc.data().username || '');
          }
        });
        setMode('training');
        setCurrentScreen('training');
      } else {
        setMode(null);
        setCurrentScreen('main');
      }
    });
    return () => unsubscribe();
  }, []);

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

    setQuestionStartTime(Date.now()); // Start timing this question

    // Ensure options is always an array
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
    if (sessionDuration && timeRemaining !== null && questions.length > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 0) {
            clearInterval(timer);
            handleSessionEnd();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [sessionDuration, timeRemaining, questions]);

  const handleSessionEnd = () => {
    alert('Training Session Time Up!');
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuestions([]);
    setSelectedCategories([]);
    setSessionDuration(null);
    setTimeRemaining(null);
    setMode('training');
    setCurrentScreen('training');
  };

  const fetchQuestions = async (categories) => {
    console.log('Fetching questions for categories:', categories);
    setLoading(true);
    setCurrentQuestionIndex(0);
    setQuestions([]);
    try {
      const getQuestions = httpsCallable(functions, 'getQuestions');
      const result = await getQuestions({ 
        categories, 
        maxQuestions: 200  // Request up to 200 questions
      });
      const fetchedQuestions = result.data.data;
      
      console.log('Received questions from cloud function:', fetchedQuestions);
  
      if (!Array.isArray(fetchedQuestions) || fetchedQuestions.length === 0) {
        console.log('No questions found for categories:', categories);
        setError('No questions available for selected categories.');
        setLoading(false);
        return;
      }
  
      // Apply your sorting logic client-side if needed
      let sortedQuestions = fetchedQuestions;
      if (user) {
        const historySnapshot = await getDocs(collection(db, `userProgress/${user.uid}/questions`));
        const history = {};
        historySnapshot.forEach(doc => {
          history[doc.data().questionId] = doc.data();
        });
  
        sortedQuestions = fetchedQuestions.sort((a, b) => {
          const aHistory = history[a.id] || { attemptsHistory: [], lastSeen: '1970-01-01T00:00:00Z' };
          const bHistory = history[b.id] || { attemptsHistory: [], lastSeen: '1970-01-01T00:00:00Z' };
          const aIncorrect = aHistory.attemptsHistory.filter(attempt => !attempt.correct).length;
          const bIncorrect = bHistory.attemptsHistory.filter(attempt => !attempt.correct).length;
          const aDaysSince = Math.min(
            (Date.now() - new Date(aHistory.lastSeen).getTime()) / (1000 * 60 * 60 * 24),
            30
          );
          const bDaysSince = Math.min(
            (Date.now() - new Date(bHistory.lastSeen).getTime()) / (1000 * 60 * 60 * 24),
            30
          );
          const aAttempts = aHistory.attemptsHistory.length;
          const bAttempts = bHistory.attemptsHistory.length;
          const aScore = (aIncorrect * 2) + (aDaysSince * 2) - (aAttempts * 0.1);
          const bScore = (bIncorrect * 2) + (bDaysSince * 2) - (bAttempts * 0.1);
          return bScore - aScore;
        });
      }
  
      setQuestions(sortedQuestions);
      console.log('Questions set:', sortedQuestions);
      setError(null);
    } catch (e) {
      console.error('Error fetching questions:', e);
      
      // Extract and format the error message
      let errorMessage = 'Failed to load questions';
      
      if (e.message) {
        if (e.message.includes('Rate limit exceeded')) {
          errorMessage = 'Rate limit exceeded. Please wait a minute before trying again.';
        } else if (e.details) {
          // Firebase Functions sometimes provides error details in this format
          errorMessage = e.details;
        } else {
          errorMessage = e.message;
        }
      }
      
      console.log('Setting error message:', errorMessage);
      setError(errorMessage);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };


  const handleSignIn = (email, password) => {
    signInWithEmailAndPassword(auth, email, password)
      .then(() => {
        setEmail('');
        setPassword('');
        setError(null);
      })
      .catch(err => setError(err.message));
  };

  const handleSignUp = async (email, password) => {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(user);
      console.log('Verification email sent—check your inbox!');
      setEmail('');
      setPassword('');
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Sign-up error:', err.message);
    }
  };

  const handleSignOut = () => {
    signOut(auth);
    setQuestions([]);
    setScore(0);
    setCurrentQuestionIndex(0);
    setSelectedCategories([]);
    setMode(null);
    setCurrentScreen('main');
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

  const handleStartTraining = (duration) => {
    if (selectedCategories.length > 0) {
      setSessionDuration(duration * 60); // Convert minutes to seconds
      setTimeRemaining(duration * 60);
      fetchQuestions(selectedCategories);
    } else {
      setError('Pick at least one category to start training!');
    }
  };

  const handleAnswerSelect = (answer) => {
    if (answered) return;
    setSelectedAnswer(answer);
    setAnswered(true);
  };

  const handleTrainingSubmit = async (answer) => {
    if (answered) return;
    const currentQuestion = questions[currentQuestionIndex];
    let userAnswer;
    const isFirstEncounter = !userHistory[currentQuestion.id];
  
    if (currentQuestion.type === 'true-false' || currentQuestion.type === 'multiple-choice') {
      userAnswer = answer;
    } else if (currentQuestion.type === 'matching') {
      userAnswer = answer;
      if (!userAnswer || Object.keys(userAnswer).length === 0) {
        setFeedback('Please select all answers before submitting!');
        return;
      }
    } else {
      userAnswer = userInput.trim();
      if (!userAnswer) {
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
        setPendingReinforcement(false); // No RT on correct
      } else if (attempts === 0) {
        setAttempts(1);
        setFeedback('Incorrect - Retry the missed ones.');
        setMatchingCorrect(correctPairs);
        setMatchingAnswers(prev => {
          const newAnswers = { ...prev };
          Object.keys(correctPairs).forEach(key => delete newAnswers[key]);
          return newAnswers;
        });
        await updateHistory(currentQuestion.id, false, userHistory); // Record first miss
      } else {
        setAnswered(true);
        setMatchingCorrect(correctPairs);
        const correctText = Object.entries(currentQuestion.answer)
          .map(([key, value]) => `${key} - ${value}`)
          .join(', ');
        setFeedback(`Incorrect, the correct matches are: ${correctText}`);
        await updateHistory(currentQuestion.id, false, userHistory); // Record second miss
        const shouldShowRT = currentQuestion.reinforcementTask && attempts === 1; // RT after second miss
        setPendingReinforcement(shouldShowRT);
      }
    } else {
      const normalizedUserAnswer = normalizeAnswer(userAnswer);
      const normalizedCorrectAnswer = normalizeAnswer(currentQuestion.answer);
      const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
  
      if (isCorrect) {
        setAnswered(true);
        setFeedback('Correct!');
        setHint('');
        setExplanation(currentQuestion.explanation || 'No explanation available.');
        await updateHistory(currentQuestion.id, true, userHistory);
        setPendingReinforcement(false); // No RT on correct
      } else if (currentQuestion.type === 'true-false') {
        setAnswered(true);
        setFeedback(`Incorrect, the answer is "${currentQuestion.answer}".`);
        setHint('');
        setExplanation(currentQuestion.explanation || 'No explanation available.');
        await updateHistory(currentQuestion.id, false, userHistory);
        setPendingReinforcement(currentQuestion.reinforcementTask); // RT for single-attempt types
      } else if (attempts === 0) {
        setAttempts(1);
        setFeedback('Incorrect');
        setHint(currentQuestion.hint || 'No hint available.');
        setExplanation('');
        setUserInput('');
        await updateHistory(currentQuestion.id, false, userHistory); // Record first miss
      } else {
        setAnswered(true);
        setFeedback(`Incorrect, the answer is "${currentQuestion.answer}".`);
        setHint('');
        setExplanation('');
        await updateHistory(currentQuestion.id, false, userHistory); // Record second miss
        const shouldShowRT = currentQuestion.reinforcementTask && attempts === 1; // RT after second miss
        setPendingReinforcement(shouldShowRT);
      }
    }
  };

  const handleMatchingSelect = (key, value) => {
    setMatchingAnswers(prev => ({ ...prev, [key]: value }));
  };

  const updateHistory = async (questionId, isCorrect, history) => {
    const now = new Date().toISOString();
    const timeSpent = questionStartTime ? Math.round((Date.now() - questionStartTime) / 1000) : 0; // Seconds
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

  const completeReinforcementAndAdvance = () => {
    const currentQuestion = questions[currentQuestionIndex];
    const normalizedInput = normalizeAnswer(reinforcementInput);
    const normalizedAnswer = normalizeAnswer(currentQuestion.answer);

    if (normalizedInput === normalizedAnswer) {
      setShowReinforcement(false);
      setReinforcementInput('');
      setFeedback('');
      setSelectedAnswer(null);
      setAnswered(false);
      setUserInput('');
      setHint('');
      setExplanation('');
      setAttempts(0);
      setMatchingAnswers({});
      setMatchingCorrect({});

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        console.log('Reinforcement completed, moving to next question:', currentQuestionIndex + 1);
      } else {
        alert('Training Complete!');
        setCurrentQuestionIndex(0);
        setScore(0);
        setQuestions([]);
        setSelectedCategories([]);
        setMode(null);
        setCurrentScreen('main');
      }
    } else {
      setFeedback('Try again!');
    }
  };

  const handleNextQuestion = () => {
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
      alert('Training Complete!');
      setCurrentQuestionIndex(0);
      setScore(0);
      setQuestions([]);
      setSelectedCategories([]);
      setSessionDuration(null);
      setTimeRemaining(null);
      setMode('training');
      setCurrentScreen('training');
    }
  };

  const handleAbandonQuiz = () => {
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setScore(0);
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
    setSelectedCategories([]);
    setSessionDuration(null);
    setTimeRemaining(null);
    setMode('training');
    setCurrentScreen('training');
  };

  if (!user) {
    return <LandingPage onSignIn={handleSignIn} onSignUp={handleSignUp} error={error} />;
  }

  return (
    <div className="App">
      <Header 
        user={user}
        username={username}
        onSignOut={handleSignOut}
        onLogoClick={() => {
          setCurrentScreen('training');
          setMode('training');
          setQuestions([]);
          setSelectedCategories([]);
          setCurrentQuestionIndex(0);
          setScore(0);
          setSessionDuration(null);
          setTimeRemaining(null);
        }}
        onProfileClick={() => setCurrentScreen('profile')}
      />
      <div className="app-content">
        {loading ? (
          <div>Loading questions...</div>
        ) : error ? (
          <div>{error}</div>
        ) : currentScreen === 'profile' ? (
          <Profile user={user} onSignOut={handleSignOut} />
        ) : currentScreen === 'training' && questions.length === 0 ? (
          <CategorySelection
            mode="training"
            categories={trainingCategories}
            selectedCategories={selectedCategories}
            onCategorySelect={handleCategorySelect}
            onStart={handleStartTraining}
            error={error}
          />
        ) : questions.length === 0 ? (
          <CategorySelection
            mode="training"
            categories={trainingCategories}
            selectedCategories={selectedCategories}
            onCategorySelect={handleCategorySelect}
            onStart={handleStartTraining}
            error={error}
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
      </div>
    </div>
  );
}

export default App;