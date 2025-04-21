import React, { useState, useEffect, useRef } from 'react';
import './QuestionScreen.css';

const QuestionScreen = ({
  mode,
  currentQuestion,
  currentQuestionIndex,
  questionsLength,
  score,
  selectedAnswer,
  answered,
  shuffledAnswers,
  userInput,
  feedback,
  hint,
  explanation,
  attempts,
  matchingAnswers,
  matchingCorrect,
  categoryName,
  pendingReinforcement,
  timeRemaining,
  sessionDuration,
  onAnswerSelect,
  onTrainingSubmit,
  onMatchingSelect,
  setUserInput,
  onNextQuestion,
  onAbandonQuiz,
  spacedRepetitionEnabled,
  dueQuestions,
  questionPriorities,
  userHistory
}) => {
  // Use local state to track displayed input only, not for controlling the actual DOM element
  const [localInput, setLocalInput] = useState(userInput);
  
  // Keep a ref of the input DOM element itself rather than just its value
  const inputElementRef = useRef(null);
  
  // Add state for tooltip visibility
  const [showPriorityTooltip, setShowPriorityTooltip] = useState(false);
  
  // Set up the ref once the component mounts
  useEffect(() => {
    // Get both possible input elements
    const answerInput = document.getElementById('answer-input');
    const fillInBlankInput = document.getElementById('fill-in-blank-input');
    
    // Store the appropriate input element in our ref
    inputElementRef.current = answerInput || fillInBlankInput;
    
    // Initialize with userInput if available
    if (inputElementRef.current && userInput) {
      inputElementRef.current.value = userInput;
    }
  }, [currentQuestionIndex, userInput]); // Update when question changes or userInput changes
  
  // Handle local display update only, real value stays in DOM
  const handleInputChange = (e) => {
    setLocalInput(e.target.value);
  };
  
  // When submitting, read directly from the DOM
  const handleSubmit = () => {
    // Get the input element value directly from DOM
    let inputValue = '';
    
    if (inputElementRef.current) {
      inputValue = inputElementRef.current.value;
    } else {
      // Fallback to looking it up again if ref is missing
      const inputElement = document.getElementById('answer-input') || document.getElementById('fill-in-blank-input');
      if (inputElement) {
        inputValue = inputElement.value;
      }
    }
    
    // Now use the DOM value which can't be affected by React state changes
    if (inputValue && inputValue.trim() !== '') {
      // Update parent state for tracking
      setUserInput(inputValue);
      // Pass the DOM value directly to onTrainingSubmit
      onTrainingSubmit(inputValue);
    } else {
      // For empty submissions, just pass empty string to get the error message
      onTrainingSubmit('');
    }
  };
  
  // Clear the ref when unmounting
  useEffect(() => {
    return () => {
      inputElementRef.current = null;
    };
  }, []);
  
  const progressPercentage = sessionDuration ? (((sessionDuration - timeRemaining) / sessionDuration) * 100).toFixed(1) : 0;

  // Handle key press events for the input fields
  const handleKeyPress = (e) => {
    // If Enter key is pressed, submit the answer
    if (e.key === 'Enter' && !answered) {
      handleSubmit();
    }
  };

  // Add focus handling for timer expiration
  useEffect(() => {
    // Check if the timer is expired
    const timerElement = document.querySelector('.vanilla-timer');
    if (timerElement && timerElement.getAttribute('data-expired') === 'true') {
      // Find the input element
      const inputElement = document.getElementById('answer-input') || document.getElementById('fill-in-blank-input');
      if (inputElement && !answered) {
        // Try to maintain focus on the input
        setTimeout(() => {
          inputElement.focus();
        }, 10);
      }
    }
  }, [answered]);

  // Determine if this question is due for review
  const isDueForReview = spacedRepetitionEnabled && dueQuestions?.includes(currentQuestion?.id);
  
  // Get the priority of this question if available
  const questionPriority = spacedRepetitionEnabled && questionPriorities?.[currentQuestion?.id];
  
  // Format priority as a percentage for display
  const priorityPercentage = questionPriority 
    ? Math.min(100, Math.round(questionPriority)) 
    : null;

  // Add a new function to format a due date
  const formatDueDate = (date) => {
    const now = new Date();
    const dueDate = new Date(date);
    
    const diffTime = Math.abs(dueDate - now);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Later today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays < 7) {
      return `In ${diffDays} days`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `In ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
    } else {
      const months = Math.floor(diffDays / 30);
      return `In ${months} ${months === 1 ? 'month' : 'months'}`;
    }
  };

  // Add a NextReviewInfo component
  const NextReviewInfo = ({ questionId, userHistory, answered, wasCorrect }) => {
    // Show this component whenever an answer has been submitted, whether correct or not
    if (!answered || !userHistory || !userHistory[questionId]) {
      return null;
    }
    
    // Calculate when this question will be due again
    const history = userHistory[questionId];
    const reviewDate = calculateDueDate(history);
    
    return (
      <div className={`next-review-info ${wasCorrect ? 'correct' : 'incorrect'}`}>
        <p>
          <span className="next-review-icon">{wasCorrect ? '📅' : '🔄'}</span>
          Next review: {formatDueDate(reviewDate)}
          {!wasCorrect && <span className="review-note"> (Prioritized for review)</span>}
        </p>
      </div>
    );
  };

  // Add the calculateDueDate function
  const calculateDueDate = (history) => {
    // If never answered correctly, due immediately
    if (!history || !history.attemptsHistory || history.attemptsHistory.length === 0) {
      return new Date(0); // Due immediately (epoch time)
    }
    
    // Get the most recent attempts
    const sortedAttempts = [...history.attemptsHistory].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    // Start with base calculation
    const lastAttempt = sortedAttempts[0];
    const lastAttemptDate = new Date(lastAttempt.timestamp);
    const wasCorrect = lastAttempt.correct;
    
    // Calculate level using consecutive correct answers
    let level = 0;
    if (wasCorrect) {
      for (let i = 0; i < sortedAttempts.length; i++) {
        if (sortedAttempts[i].correct) {
          level++;
        } else {
          break;
        }
      }
    } else {
      // If incorrect, decrease level by 1 but not below 0
      // Look for previous streak before the incorrect answer
      if (sortedAttempts.length > 1) {
        for (let i = 1; i < sortedAttempts.length; i++) {
          if (sortedAttempts[i].correct) {
            level++;
          } else {
            break;
          }
        }
        level = Math.max(0, level - 1);
      }
    }
    
    // Cap level at 15
    level = Math.min(15, level);
    
    // Fibonacci-based intervals (better than exponential for practical purposes)
    // 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987 days
    const fibonacci = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
    const intervalDays = wasCorrect ? fibonacci[level] : 1;
    
    // Convert interval (days) to milliseconds and add to last attempt date
    const dueDate = new Date(lastAttemptDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    return dueDate;
  };

  // Utility functions for compressed learning state
  const compressLearningState = (history) => {
    if (!history || !history.attemptsHistory || history.attemptsHistory.length === 0) {
      return null;
    }

    // Sort attempts by timestamp (newest first)
    const sortedAttempts = [...history.attemptsHistory].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    // Calculate level using SM-2 algorithm
    let level = 0;
    let correctStreak = 0;
    for (let i = 0; i < sortedAttempts.length; i++) {
      if (sortedAttempts[i].correct) {
        correctStreak++;
      } else {
        break;
      }
    }
    level = Math.min(15, correctStreak);

    // Count correct and incorrect answers
    const correctCount = sortedAttempts.filter(a => a.correct).length;
    const incorrectCount = sortedAttempts.filter(a => !a.correct).length;

    // Get the last review timestamp
    const lastReviewTimestamp = new Date(sortedAttempts[0].timestamp).getTime();

    // Calculate due date based on SM-2 algorithm
    const dueDate = calculateDueDate(history).getTime();

    // Generate binary history string (1=correct, 0=incorrect), recent first
    // Limit to last 20 attempts to keep it manageable
    const binaryHistory = sortedAttempts.slice(0, 20)
      .map(a => a.correct ? '1' : '0')
      .join('');

    // Return compressed state
    return {
      qid: history.questionId,
      lvl: level,
      c: correctCount,
      i: incorrectCount,
      lrn: lastReviewTimestamp,
      due: dueDate,
      hist: binaryHistory
    };
  };

  const expandLearningState = (compressedState) => {
    if (!compressedState) return null;

    const { qid, hist, lrn } = compressedState;
    
    // Convert binary history string to attemptsHistory array
    const attemptsHistory = [];
    const baseTime = lrn; // Use the last review time as a base
    
    for (let i = 0; i < hist.length; i++) {
      // Simulate timestamps by going backward in time (newest first)
      // Each attempt is roughly 1-7 days apart for simplicity
      const timestamp = new Date(baseTime - (i * 24 * 60 * 60 * 1000));
      
      attemptsHistory.push({
        questionId: qid,
        timestamp: timestamp.toISOString(),
        correct: hist[i] === '1'
      });
    }
    
    return {
      questionId: qid,
      attemptsHistory
    };
  };

  return (
    <div className="question-container">
      <h1>TriviaTrainer</h1>
      <p>Category: {categoryName}</p>
      {spacedRepetitionEnabled && (
        <div className="spaced-repetition-indicators">
          {isDueForReview && (
            <span className="due-indicator">Due for review</span>
          )}
          {priorityPercentage !== null && (
            <div className="priority-indicator-container">
              <span className="priority-indicator" 
                style={{ 
                  backgroundColor: `rgba(${priorityPercentage > 70 ? '220, 53, 69' : '66, 133, 244'}, ${priorityPercentage/100})` 
                }}
                onMouseEnter={() => setShowPriorityTooltip(true)}
                onMouseLeave={() => setShowPriorityTooltip(false)}
              >
                Priority: {priorityPercentage}%
              </span>
              {showPriorityTooltip && (
                <div className="priority-tooltip">
                  <p><strong>What this means:</strong></p>
                  <p>This percentage shows how important it is for you to review this question now.</p>
                  <ul>
                    <li><strong>High (70-100%):</strong> Needs urgent review</li>
                    <li><strong>Medium (40-69%):</strong> Good to practice</li>
                    <li><strong>Low (0-39%):</strong> Well mastered</li>
                  </ul>
                  <p>Based on your past performance and when you last saw this question.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {mode === 'quiz' && <p>Score: {score} / {questionsLength}</p>}
      <div className="question-content">
        <h2>Question:</h2>
        {currentQuestion.type === 'fill-in-the-blank' && mode !== 'quiz' ? (
          <div className="fill-in-the-blank-container">
            <p>
              {currentQuestion.question.split('____').map((part, index) => (
                <span key={index}>
                  {part}
                  {index === 0 && (
                    <input
                      type="text"
                      id="fill-in-blank-input"
                      name="fill-in-blank-input"
                      defaultValue={userInput} // Use defaultValue instead of value for uncontrolled component
                      onChange={handleInputChange}
                      placeholder="Fill in"
                      disabled={answered}
                      className="fill-in-blank"
                      onKeyPress={handleKeyPress}
                      autoComplete="off" // Prevent browser from interfering
                      ref={inputElementRef}
                    />
                  )}
                </span>
              ))}
            </p>
            {!answered && (
              <button onClick={handleSubmit}>Submit</button>
            )}
          </div>
        ) : (
          <p dangerouslySetInnerHTML={{ __html: currentQuestion.question }} />
        )}
        <div className="answer-area">
          {mode === 'quiz' ? (
            <>
              <h3>Options:</h3>
              <ul>
                {shuffledAnswers.map((answer, index) => (
                  <li
                    key={index}
                    onClick={() => onAnswerSelect(answer)}
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
                    onClick={() => onTrainingSubmit('True')}
                    disabled={answered}
                    className="tf-button"
                  >
                    True
                  </button>
                  <button
                    onClick={() => onTrainingSubmit('False')}
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
                      onClick={() => onTrainingSubmit(option)}
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
                          id={`matching-select-${key}`}
                          name={`matching-select-${key}`}
                          value={matchingAnswers[key] || ''}
                          onChange={(e) => onMatchingSelect(key, e.target.value)}
                          disabled={answered}
                        >
                          <option value="">Select</option>
                          {Array.isArray(currentQuestion.options) ? 
                            currentQuestion.options.map((option, index) => (
                              <option key={`${option}-${index}`} value={option}>{option}</option>
                            )) : 
                            Object.values(currentQuestion.options || {}).map((option, index) => (
                              <option key={`${option}-${index}`} value={option}>{option}</option>
                            ))
                          }
                        </select>
                      )}
                    </div>
                  ))}
                  {!answered && (
                    <button onClick={() => onTrainingSubmit(matchingAnswers)}>Submit</button>
                  )}
                </div>
              ) : currentQuestion.type !== 'fill-in-the-blank' ? (
                <div className="text-input-container">
                  <input
                    type="text"
                    id="answer-input"
                    name="answer-input"
                    defaultValue={userInput} // Use defaultValue for uncontrolled component
                    onChange={handleInputChange}
                    placeholder="Type your answer"
                    disabled={answered}
                    className="text-input"
                    onKeyPress={handleKeyPress}
                    autoComplete="off" // Prevent browser from interfering
                  />
                  {!answered && (
                    <button onClick={handleSubmit}>Submit</button>
                  )}
                </div>
              ) : null}
              {feedback && (
                <p className={feedback === 'Correct!' ? 'correct-feedback' : 'incorrect-feedback'}>
                  {feedback}
                </p>
              )}
              {hint && <p className="hint">Hint: {hint}</p>}
            </div>
          )}
        </div>
        {explanation && <p className="explanation">{explanation}</p>}
        
        {spacedRepetitionEnabled && (
          <NextReviewInfo 
            questionId={currentQuestion?.id}
            userHistory={userHistory}
            answered={answered}
            wasCorrect={feedback === 'Correct!'}
          />
        )}
      </div>
      <div className="button-container">
        {answered && (
          <button onClick={onNextQuestion}>
            {pendingReinforcement
              ? 'Reinforcement Task'
              : currentQuestionIndex < questionsLength - 1
              ? 'Next Question'
              : 'Finish'}
          </button>
        )}
        <button onClick={onAbandonQuiz} style={{ backgroundColor: '#dc3545' }}>
          Abandon {mode === 'quiz' ? 'Quiz' : 'Training'}
        </button>
      </div>
    </div>
  );
};

export default QuestionScreen;