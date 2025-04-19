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
  questionPriorities
}) => {
  // Use local state to track displayed input only, not for controlling the actual DOM element
  const [localInput, setLocalInput] = useState(userInput);
  
  // Keep a ref of the input DOM element itself rather than just its value
  const inputElementRef = useRef(null);
  
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
            <span className="priority-indicator" 
              style={{ 
                backgroundColor: `rgba(${priorityPercentage > 70 ? '220, 53, 69' : '66, 133, 244'}, ${priorityPercentage/100})` 
              }}>
              Priority: {priorityPercentage}%
            </span>
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
                            currentQuestion.options.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            )) : 
                            Object.values(currentQuestion.options || {}).map((option) => (
                              <option key={option} value={option}>{option}</option>
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