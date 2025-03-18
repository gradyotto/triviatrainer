import React from 'react';

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
  onAnswerSelect,
  onTrainingSubmit,
  onMatchingSelect,
  setUserInput,
  onNextQuestion,
  onAbandonQuiz
}) => (
  <div>
    <h1>TriviaTrainer - {mode === 'quiz' ? 'Quiz Mode' : 'Training Mode'}</h1>
    <p>Category: {categoryName}</p>
    {mode === 'quiz' && <p>Score: {score} / {questionsLength}</p>}
    <p>Question {currentQuestionIndex + 1} of {questionsLength}</p>
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
                      value={matchingAnswers[key] || ''}
                      onChange={(e) => onMatchingSelect(key, e.target.value)}
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
                <button onClick={() => onTrainingSubmit()}>Submit</button>
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
                <button onClick={() => onTrainingSubmit()}>Submit</button>
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
      {answered && (
        <button onClick={onNextQuestion}>
          {currentQuestionIndex < questionsLength - 1 ? 'Next Question' : 'Finish'}
        </button>
      )}
      <button onClick={onAbandonQuiz} style={{ backgroundColor: '#dc3545' }}>
        Abandon {mode === 'quiz' ? 'Quiz' : 'Training'}
      </button>
    </div>
  </div>
);

export default QuestionScreen;