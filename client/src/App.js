import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, addDoc, getDoc, setDoc } from 'firebase/firestore';
import LandingPage from './LandingPage';
import Header from './Header'; // New
import ModeSelection from './ModeSelection'; // New
import CategorySelection from './CategorySelection'; // New
import QuestionScreen from './QuestionScreen'; // New
import ReinforcementTask from './ReinforcementTask'; // New
import Profile from './Profile'; // Re-added
import './App.css';

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
  return normalizeNumber(
    input
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .toLowerCase()
      .trim()
  );
};

const quizCategories = [
  { id: 9, name: 'General Knowledge' },
  { id: 10, name: 'Books' },
  { id: 11, name: 'Film' },
  { id: 17, name: 'Science & Nature' },
  { id: 23, name: 'History' },
  { id: 21, name: 'Sports' }
];

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
  const [currentScreen, setCurrentScreen] = useState('main'); // Added for routing

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
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!questions || questions.length === 0 || currentQuestionIndex >= questions.length) {
      console.log('Skipping shuffle: questions not ready or index out of bounds', {
        questionsLength: questions.length,
        currentQuestionIndex
      });
      setShuffledAnswers([]);
      return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion || !currentQuestion.type) {
      console.log('Invalid currentQuestion:', currentQuestion);
      setShuffledAnswers([]);
      return;
    }

    console.log('Shuffling answers for:', currentQuestion);

    if (mode === 'quiz') {
      const correctAnswer = currentQuestion.answer;
      const incorrectAnswers = currentQuestion.type === 'true-false' 
        ? [correctAnswer === 'True' ? 'False' : 'True']
        : ['Incorrect 1', 'Incorrect 2', 'Incorrect 3'];
      const allAnswers = [...incorrectAnswers, correctAnswer];
      setShuffledAnswers(allAnswers.sort(() => Math.random() - 0.5));
    } else if (currentQuestion.type === 'multiple-choice') {
      setShuffledAnswers((currentQuestion.options || []).sort(() => Math.random() - 0.5));
    } else if (currentQuestion.type === 'matching') {
      setMatchingAnswers({});
      setMatchingCorrect({});
      setShuffledAnswers((currentQuestion.options || []).sort(() => Math.random() - 0.5));
    } else {
      setShuffledAnswers([]);
    }
  }, [questions, currentQuestionIndex, mode]);

  const fetchQuestions = async (categories) => {
    console.log('Fetching questions for categories:', categories);
    setLoading(true);
    setCurrentQuestionIndex(0);
    setQuestions([]);
    try {
      const querySnapshot = await getDocs(collection(db, 'questions'));
      const allQuestions = querySnapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
      console.log('All questions from Firestore:', allQuestions);

      const fetchedQuestions = allQuestions.filter(q => 
        !categories || categories.length === 0 || categories.includes(q.category)
      );
      console.log('Fetched questions after filter:', fetchedQuestions);

      if (fetchedQuestions.length === 0) {
        console.log('No questions found for categories:', categories);
        setError('No questions available for selected categories.');
        setLoading(false);
        return;
      }

      let sortedQuestions = fetchedQuestions;
      if (mode === 'training' && user) {
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

        console.log('Sorted questions with spaced repetition:', sortedQuestions.map(q => ({
          id: q.id,
          question: q.question,
          incorrectCount: history[q.id]?.attemptsHistory.filter(a => !a.correct).length || 0,
          daysSinceLastSeen: history[q.id] 
            ? ((Date.now() - new Date(history[q.id].lastSeen).getTime()) / (1000 * 60 * 60 * 24)).toFixed(2)
            : '30 (unseen)',
          totalAttempts: history[q.id]?.attemptsHistory.length || 0,
          score: history[q.id] 
            ? ((history[q.id].attemptsHistory.filter(a => !a.correct).length * 2) + 
               ((Date.now() - new Date(history[q.id].lastSeen).getTime()) / (1000 * 60 * 60 * 24) * 2) - 
               (history[q.id].attemptsHistory.length * 0.1)).toFixed(2)
            : '60 (unseen)'
        })));
      }

      setQuestions(sortedQuestions);
      console.log('Questions set:', sortedQuestions);
      setError(null);
    } catch (error) {
      console.error('Error fetching questions:', error);
      setError('Failed to load questions');
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

  const handleSignUp = (email, password) => {
    createUserWithEmailAndPassword(auth, email, password)
      .then(() => {
        setEmail('');
        setPassword('');
        setError(null);
      })
      .catch(err => setError(err.message));
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
  };

  const handleModeSelect = (selectedMode) => {
    setMode(selectedMode);
    setCurrentScreen(selectedMode);
  };

  const handleCategorySelect = (categoryId) => {
    console.log('Category selected:', categoryId);
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId) 
        : [...prev, categoryId]
    );
  };

  const handleStartTraining = () => {
    if (selectedCategories.length > 0) {
      console.log('Starting training with categories:', selectedCategories);
      fetchQuestions(selectedCategories);
    } else {
      setError('Please select at least one category.');
    }
  };

  const handleRandomCategory = () => {
    console.log('Selecting random category');
    setSelectedCategories(['random']);
    fetchQuestions(trainingCategories.map(cat => cat.id));
  };

  const handleAnswerSelect = (answer) => {
    if (answered) return;
    setSelectedAnswer(answer);
    setAnswered(true);
    const currentQuestion = questions[currentQuestionIndex];
    if (mode === 'quiz' && answer === currentQuestion.answer) {
      setScore(score + 1);
    }
  };

  const handleTrainingSubmit = async (answer) => {
    if (answered) return;
    const currentQuestion = questions[currentQuestionIndex];
    let userAnswer;
    const isFirstEncounter = !userHistory[currentQuestion.id];

    if (currentQuestion.type === 'true-false' || currentQuestion.type === 'multiple-choice') {
      userAnswer = answer;
    } else if (currentQuestion.type === 'matching') {
      userAnswer = matchingAnswers;
    } else {
      userAnswer = userInput.trim();
      if (!userAnswer) {
        setFeedback('Come on - at least give it a shot!');
        return;
      }
    }

    if (currentQuestion.type === 'matching') {
      const combinedAnswers = { ...currentQuestion.answer, ...matchingAnswers };
      const correctPairs = { ...matchingCorrect };
      let allCorrect = true;

      Object.keys(currentQuestion.answer).forEach(key => {
        const normalizedUserValue = normalizeAnswer(combinedAnswers[key] || '');
        const normalizedCorrectValue = normalizeAnswer(currentQuestion.answer[key]);
        const isCorrect = normalizedUserValue === normalizedCorrectValue;
        if (isCorrect) correctPairs[key] = true;
        allCorrect = allCorrect && isCorrect;
      });

      console.log('Matching correct:', allCorrect);
      if (allCorrect) {
        setAnswered(true);
        setFeedback('Correct!');
        setMatchingCorrect(correctPairs);
        await updateHistory(currentQuestion.id, true, userHistory);
        const shouldShowRT = currentQuestion.reinforcementTask && (isFirstEncounter || attempts > 0);
        console.log(`Matching RT check - First: ${isFirstEncounter}, Correct: ${allCorrect}, Has RT: ${!!currentQuestion.reinforcementTask}, Result: ${shouldShowRT}`);
        setShowReinforcement(shouldShowRT);
      } else if (attempts === 0) {
        setAttempts(1);
        setFeedback('Incorrect - Retry the missed ones.');
        setMatchingCorrect(correctPairs);
        setMatchingAnswers(prev => {
          const newAnswers = { ...prev };
          Object.keys(correctPairs).forEach(key => delete newAnswers[key]);
          return newAnswers;
        });
      } else {
        setAnswered(true);
        setMatchingCorrect(correctPairs);
        const correctText = Object.entries(currentQuestion.answer)
          .map(([key, value]) => `${key} - ${value}`)
          .join(', ');
        setFeedback(`Incorrect, the correct matches are: ${correctText}`);
        await updateHistory(currentQuestion.id, false, userHistory);
        const shouldShowRT = currentQuestion.reinforcementTask && attempts > 0;
        console.log(`Matching RT check - First: ${isFirstEncounter}, Correct: ${allCorrect}, Has RT: ${!!currentQuestion.reinforcementTask}, Result: ${shouldShowRT}`);
        setShowReinforcement(shouldShowRT);
      }
    } else {
      const normalizedUserAnswer = normalizeAnswer(userAnswer);
      const normalizedCorrectAnswer = normalizeAnswer(currentQuestion.answer);
      const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;

      console.log('Normalized user answer:', normalizedUserAnswer, 'Expected:', normalizedCorrectAnswer);

      if (isCorrect) {
        setAnswered(true);
        setFeedback('Correct!');
        setHint('');
        setExplanation(currentQuestion.explanation || 'No explanation available.');
        await updateHistory(currentQuestion.id, true, userHistory);
        const shouldShowRT = currentQuestion.reinforcementTask && (isFirstEncounter || attempts > 0);
        console.log(`RT check - First: ${isFirstEncounter}, Correct: ${isCorrect}, Has RT: ${!!currentQuestion.reinforcementTask}, Result: ${shouldShowRT}`);
        setShowReinforcement(shouldShowRT);
      } else if (currentQuestion.type === 'true-false') {
        setAnswered(true);
        setFeedback(`Incorrect, the answer is "${currentQuestion.answer}".`);
        setHint('');
        setExplanation(currentQuestion.explanation || 'No explanation available.');
        await updateHistory(currentQuestion.id, false, userHistory);
        const shouldShowRT = currentQuestion.reinforcementTask && attempts > 0;
        console.log(`RT check - First: ${isFirstEncounter}, Correct: ${isCorrect}, Has RT: ${!!currentQuestion.reinforcementTask}, Result: ${shouldShowRT}`);
        setShowReinforcement(shouldShowRT);
      } else if (attempts === 0) {
        setAttempts(1);
        setFeedback('Incorrect');
        setHint(currentQuestion.hint || 'No hint available.');
        setExplanation('');
        setUserInput('');
      } else {
        setAnswered(true);
        setFeedback(`Incorrect, the answer is "${currentQuestion.answer}".`);
        setHint('');
        setExplanation('');
        await updateHistory(currentQuestion.id, false, userHistory);
        const shouldShowRT = currentQuestion.reinforcementTask && attempts > 0;
        console.log(`RT check - First: ${isFirstEncounter}, Correct: ${isCorrect}, Has RT: ${!!currentQuestion.reinforcementTask}, Result: ${shouldShowRT}`);
        setShowReinforcement(shouldShowRT);
      }
    }
  };

  const handleMatchingSelect = (key, value) => {
    setMatchingAnswers(prev => ({ ...prev, [key]: value }));
  };

  const updateHistory = async (questionId, isCorrect, history) => {
    const now = new Date().toISOString();
    const currentHistory = history[questionId] || { firstSeen: now, lastSeen: now, attemptsHistory: [] };
    
    const updatedAttempts = [
      ...currentHistory.attemptsHistory,
      { timestamp: now, correct: isCorrect }
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
        correct: isCorrect
      });

      console.log(`History updated in Firestore for q${questionId}`);
    } catch (e) {
      console.error('Error updating history:', e);
    }
  };

  const completeReinforcementAndAdvance = () => {
    const currentQuestion = questions[currentQuestionIndex];
    const normalizedInput = normalizeAnswer(reinforcementInput);
    const normalizedAnswer = normalizeAnswer(currentQuestion.answer);

    console.log('Reinforcement - Normalized input:', normalizedInput, 'Expected:', normalizedAnswer);

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
        alert(mode === 'quiz' ? `Game Over! Your score: ${score}/${questions.length}` : 'Training Complete!');
        setCurrentQuestionIndex(0);
        setScore(0);
        setQuestions([]);
        setSelectedCategories([]);
        setMode(null);
        setCurrentScreen('main');
        console.log('Training complete');
      }
    } else {
      setFeedback('Try again!');
      console.log('Reinforcement incorrect:', reinforcementInput);
    }
  };

  const handleNextQuestion = () => {
    if (showReinforcement) {
      setFeedback('Please complete the reinforcement task.');
      console.log('Next blocked - reinforcement pending');
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
      console.log('Moving to next question:', currentQuestionIndex + 1);
    } else {
      alert(mode === 'quiz' ? `Game Over! Your score: ${score}/${questions.length}` : 'Training Complete!');
      setCurrentQuestionIndex(0);
      setScore(0);
      setQuestions([]);
      setSelectedCategories([]);
      setMode(null);
      setCurrentScreen('main');
      console.log('Training complete');
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
    setMode(null);
    setCurrentScreen('main');
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
          setCurrentScreen('main');
          setMode(null);               // Reset mode
          setQuestions([]);            // Clear questions
          setSelectedCategories([]);   // Clear categories
          setCurrentQuestionIndex(0);  // Reset index
          setScore(0);                 // Reset score
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
        ) : currentScreen === 'main' && !mode ? (
          <ModeSelection onModeSelect={handleModeSelect} />
        ) : currentScreen === 'training' && questions.length === 0 ? (
          <CategorySelection
            mode="training"
            categories={trainingCategories}
            selectedCategories={selectedCategories}
            onCategorySelect={handleCategorySelect}
            onStart={handleStartTraining}
            error={error}
          />
        ) : currentScreen === 'quiz' && !selectedCategories.length ? (
          <CategorySelection
            mode="quiz"
            categories={quizCategories}
            selectedCategories={selectedCategories}
            onCategorySelect={handleCategorySelect}
            onRandomCategory={handleRandomCategory}
            fetchQuestions={fetchQuestions}
          />
        ) : questions.length === 0 ? (
          <div>No questions loaded yet.</div>
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
              mode === 'quiz'
                ? (selectedCategories[0] === 'random' ? 'Random' : quizCategories.find(cat => cat.id === selectedCategories[0])?.name)
                : (selectedCategories.length === trainingCategories.length 
                    ? 'All Categories' 
                    : selectedCategories.map(id => trainingCategories.find(cat => cat.id === id)?.name).join(', '))
            }
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