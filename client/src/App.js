import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import './App.css';

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

  const fetchUserHistory = async (uid) => {
    try {
      const historySnapshot = await getDocs(collection(db, `userProgress/${uid}/questions`));
      const history = {};
      historySnapshot.forEach(doc => {
        const data = doc.data();
        history[data.questionId] = {
          firstSeen: data.firstSeen,
          lastSeen: data.lastSeen,
          attemptsHistory: data.attemptsHistory || []
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
    setQuestions([]); // Clear questions first
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
  
  const handleAnswerSelect = (answer) => {
    if (answered) return;
    setSelectedAnswer(answer);
    setAnswered(true);
    const currentQuestion = questions[currentQuestionIndex];
    if (mode === 'quiz' && answer === currentQuestion.answer) {
      setScore(score + 1);
    }
  };
  
  const handleTrainingSubmit = (answer) => {
    if (answered) return;
    const currentQuestion = questions[currentQuestionIndex];
    let userAnswer;
  
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
  
    const history = { ...userHistory };
    const isFirstEncounter = !history[currentQuestion.id];
    console.log('Pre-submit history:', history);
    console.log('Question has RT:', !!currentQuestion.reinforcementTask);
    console.log('User answer:', userAnswer);
    console.log('Attempts:', attempts);
  
    if (currentQuestion.type === 'matching') {
      const combinedAnswers = { ...currentQuestion.answer, ...matchingAnswers };
      const correctPairs = { ...matchingCorrect };
      let allCorrect = true;
  
      Object.keys(currentQuestion.answer).forEach(key => {
        const isCorrect = combinedAnswers[key] === currentQuestion.answer[key];
        if (isCorrect) correctPairs[key] = true;
        allCorrect = allCorrect && isCorrect;
      });
  
      console.log('Matching correct:', allCorrect);
      if (allCorrect) {
        setAnswered(true);
        setFeedback('Correct!');
        setMatchingCorrect(correctPairs);
        updateHistory(currentQuestion.id, true, history);
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
        updateHistory(currentQuestion.id, false, history);
        const shouldShowRT = currentQuestion.reinforcementTask && attempts > 0;
        console.log(`Matching RT check - First: ${isFirstEncounter}, Correct: ${allCorrect}, Has RT: ${!!currentQuestion.reinforcementTask}, Result: ${shouldShowRT}`);
        setShowReinforcement(shouldShowRT);
      }
    } else {
      const isCorrect = userAnswer.toLowerCase() === currentQuestion.answer.toLowerCase();
      console.log('Non-matching correct:', isCorrect, 'Expected:', currentQuestion.answer.toLowerCase());
  
      if (isCorrect) {
        setAnswered(true);
        setFeedback('Correct!');
        setHint('');
        setExplanation(currentQuestion.explanation || 'No explanation available.');
        updateHistory(currentQuestion.id, true, history);
        const shouldShowRT = currentQuestion.reinforcementTask && (isFirstEncounter || attempts > 0);
        console.log(`RT check - First: ${isFirstEncounter}, Correct: ${isCorrect}, Has RT: ${!!currentQuestion.reinforcementTask}, Result: ${shouldShowRT}`);
        setShowReinforcement(shouldShowRT);
      } else if (currentQuestion.type === 'true-false') {
        setAnswered(true);
        setFeedback(`Incorrect, the answer is "${currentQuestion.answer}".`);
        setHint('');
        setExplanation(currentQuestion.explanation || 'No explanation available.');
        updateHistory(currentQuestion.id, false, history);
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
        updateHistory(currentQuestion.id, false, history);
        const shouldShowRT = currentQuestion.reinforcementTask && attempts > 0;
        console.log(`RT check - First: ${isFirstEncounter}, Correct: ${isCorrect}, Has RT: ${!!currentQuestion.reinforcementTask}, Result: ${shouldShowRT}`);
        setShowReinforcement(shouldShowRT);
      }
    }
  };
  
  const handleMatchingSelect = (key, value) => {
    setMatchingAnswers(prev => ({ ...prev, [key]: value }));
  };
  
  const updateHistory = (questionId, isCorrect, history) => {
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
  
    setDoc(doc(db, `userProgress/${user.uid}/questions`, String(questionId)), {
      questionId,
      firstSeen: currentHistory.firstSeen,
      lastSeen: now,
      attemptsHistory: updatedAttempts
    })
      .then(() => console.log(`History updated in Firestore for q${questionId}:`, updatedHistory[questionId]))
      .catch(e => console.error('Error updating history:', e));
  };
  
  const completeReinforcementAndAdvance = () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (reinforcementInput.trim().toLowerCase() === currentQuestion.answer.toLowerCase()) {
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
  };
  
  const handleSignIn = (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, email, password)
      .then(() => {
        setEmail('');
        setPassword('');
        setError(null);
      })
      .catch(err => setError(err.message));
  };
  
  const handleSignUp = (e) => {
    e.preventDefault();
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
  };
  
  const handleModeSelect = (selectedMode) => {
    setMode(selectedMode);
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
  
  if (!user) {
    return (
      <div className="App">
        <h1>TriviaTrainer</h1>
        <h2>Sign In or Sign Up</h2>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <form onSubmit={handleSignIn}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">Sign In</button>
          <button type="button" onClick={handleSignUp}>Sign Up</button>
        </form>
      </div>
    );
  }
  
  if (loading) {
    return <div>Loading questions...</div>;
  }
  
  if (error) {
    return <div>{error}</div>;
  }
  
  if (!mode) {
    return (
      <div className="App">
        <h1>TriviaTrainer</h1>
        <p>Welcome, {user.email}!</p>
        <button onClick={handleSignOut}>Sign Out</button>
        <h2>Choose Your Mode</h2>
        <div className="mode-buttons">
          <button onClick={() => handleModeSelect('training')} className="mode-button">
            Training Mode
          </button>
          <button onClick={() => handleModeSelect('quiz')} className="mode-button">
            Quiz Mode
          </button>
        </div>
      </div>
    );
  }
  
  if (mode === 'training' && questions.length === 0) {
    return (
      <div className="App">
        <h1>TriviaTrainer - Training Mode</h1>
        <p>Welcome, {user.email}!</p>
        <button onClick={handleSignOut}>Sign Out</button>
        <h2>Select Categories (choose multiple)</h2>
        <div className="category-buttons">
          {trainingCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              className={`category-button ${selectedCategories.includes(cat.id) ? 'selected' : ''}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <button onClick={handleStartTraining} disabled={!selectedCategories.length}>
          Start Training
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    );
  }
  
  if (mode === 'quiz' && !selectedCategories.length) {
    const categoriesToShow = quizCategories;
    return (
      <div className="App">
        <h1>TriviaTrainer - Quiz Mode</h1>
        <p>Welcome, {user.email}!</p>
        <button onClick={handleSignOut}>Sign Out</button>
        <h2>Select a Category</h2>
        <div className="category-buttons">
          <button
            onClick={handleRandomCategory}
            className="category-button random-category"
          >
            Random Category
          </button>
          <div className="specific-categories">
            {categoriesToShow.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  handleCategorySelect(cat.id);
                  fetchQuestions([cat.id]);
                }}
                className="category-button"
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (questions.length === 0) {
    return <div>No questions loaded yet.</div>;
  }
  
  const currentQuestion = questions[currentQuestionIndex];
  const categoryName = mode === 'quiz' 
    ? (selectedCategories[0] === 'random' ? 'Random' : quizCategories.find(cat => cat.id === selectedCategories[0])?.name)
    : (selectedCategories.length === trainingCategories.length 
        ? 'All Categories' 
        : selectedCategories.map(id => trainingCategories.find(cat => cat.id === id)?.name).join(', '));
  
  if (showReinforcement) {
    return (
      <div className="App">
        <h1>Reinforcement Task</h1>
        <p>{currentQuestion.reinforcementTask}</p>
        <input
          type="text"
          value={reinforcementInput}
          onChange={(e) => setReinforcementInput(e.target.value)}
          placeholder="Type here"
        />
        <button onClick={completeReinforcementAndAdvance}>Submit</button>
        {feedback && (
          <p className={feedback === 'Correct!' ? 'correct-feedback' : 'incorrect-feedback'}>
            {feedback}
          </p>
        )}
      </div>
    );
  }
  
  return (
    <div className="App">
      <h1>TriviaTrainer - {mode === 'quiz' ? 'Quiz Mode' : 'Training Mode'}</h1>
      <p>Welcome, {user.email}!</p>
      <button onClick={handleSignOut}>Sign Out</button>
      <p>Category: {categoryName}</p>
      {mode === 'quiz' && <p>Score: {score} / {questions.length}</p>}
      <p>Question {currentQuestionIndex + 1} of {questions.length}</p>
      <div>
        <h2>Question:</h2>
        {currentQuestion.type === 'fill-in-the-blank' && mode !== 'quiz' ? (
          <p>
            {currentQuestion.question.split('____').map((part, index) => (
              <span key={index}>
                {part}
                {index === 0 && (
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Fill in"
                    disabled={answered}
                    className="fill-in-blank"
                  />
                )}
              </span>
            ))}
          </p>
        ) : (
          <p dangerouslySetInnerHTML={{ __html: currentQuestion.question }} />
        )}
        {mode === 'quiz' ? (
          <>
            <h3>Options:</h3>
            <ul>
              {shuffledAnswers.map((answer, index) => (
                <li
                  key={index}
                  onClick={() => handleAnswerSelect(answer)}
                  className={
                    answered
                      ? answer === currentQuestion.answer
                        ? 'correct'
                        : selectedAnswer === answer
                        ? 'incorrect'
                        : ''
                      : ''
                  }
                  style={{ cursor: answered ? 'default' : 'pointer' }}
                  dangerouslySetInnerHTML={{ __html: answer }}
                />
              ))}
            </ul>
          </>
        ) : (
          <div>
            {currentQuestion.type === 'true-false' ? (
              <div className="true-false-buttons">
                <button
                  onClick={() => handleTrainingSubmit('True')}
                  disabled={answered}
                  className="tf-button"
                >
                  True
                </button>
                <button
                  onClick={() => handleTrainingSubmit('False')}
                  disabled={answered}
                  className="tf-button"
                >
                  False
                </button>
              </div>
            ) : currentQuestion.type === 'multiple-choice' ? (
              <ul>
                {shuffledAnswers.map((option, index) => (
                  <li
                    key={index}
                    onClick={() => handleTrainingSubmit(option)}
                    className={answered && option === currentQuestion.answer ? 'correct' : ''}
                    style={{ cursor: answered ? 'default' : 'pointer' }}
                  >
                    {option}
                  </li>
                ))}
              </ul>
            ) : currentQuestion.type === 'matching' ? (
              <div className="matching">
                {Object.keys(currentQuestion.answer).map((key) => (
                  <div key={key} className="matching-pair">
                    <span>{key}</span>
                    {matchingCorrect[key] ? (
                      <span className="locked-answer">
                        {currentQuestion.answer[key]}
                        <span className="correct-feedback">✓</span>
                      </span>
                    ) : (
                      <select
                        value={matchingAnswers[key] || ''}
                        onChange={(e) => handleMatchingSelect(key, e.target.value)}
                        disabled={answered}
                      >
                        <option value="">Select</option>
                        {currentQuestion.options.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
                {!answered && (
                  <button onClick={() => handleTrainingSubmit()}>Submit</button>
                )}
              </div>
            ) : (
              <>
                {currentQuestion.type !== 'fill-in-the-blank' && (
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Type your answer"
                    disabled={answered}
                  />
                )}
                {!answered && (
                  <button onClick={() => handleTrainingSubmit()}>Submit</button>
                )}
              </>
            )}
            {feedback && (
              <p className={feedback === 'Correct!' ? 'correct-feedback' : 'incorrect-feedback'}>
                {feedback}
              </p>
            )}
            {hint && <p className="hint">Hint: {hint}</p>}
            {explanation && <p className="explanation">{explanation}</p>}
          </div>
        )}
        {answered && !showReinforcement && (
          <button onClick={handleNextQuestion}>
            {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish'}
          </button>
        )}
        <button onClick={handleAbandonQuiz} style={{ backgroundColor: '#dc3545' }}>
          Abandon {mode === 'quiz' ? 'Quiz' : 'Training'}
        </button>
      </div>
    </div>
  );
  }
  
  export default App;