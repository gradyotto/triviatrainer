import React, { useState, useEffect } from 'react';
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
  onAbandonQuiz
}) => {
  // Use local state to prevent focus loss when typing
  const [localInput, setLocalInput] = useState(userInput);
  
  // Sync local input with parent state when userInput changes from parent
  useEffect(() => {
    setLocalInput(userInput);
  }, [userInput]);
  
  // Handle local input change
  const handleInputChange = (e) => {
    setLocalInput(e.target.value);
  };
  
  // When submitting, update parent state
  const handleSubmit = () => {
    // Only update parent state if there's actually input
    setUserInput(localInput);
    // Pass the local input value directly to onTrainingSubmit
    onTrainingSubmit(localInput);
  };
  
  const progressPercentage = sessionDuration ? (((sessionDuration - timeRemaining) / sessionDuration) * 100).toFixed(1) : 0;

  return (
    <div className="question-container">
      <h1>TriviaTrainer</h1>
      <p>Category: {categoryName}</p>
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
                      value={localInput}
                      onChange={handleInputChange}
                      placeholder="Fill in"
                      disabled={answered}
                      className="fill-in-blank"
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
                    value={localInput}
                    onChange={handleInputChange}
                    placeholder="Type your answer"
                    disabled={answered}
                    className="text-input"
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