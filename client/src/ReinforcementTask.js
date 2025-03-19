import React from 'react';
import './ReinforcementTask.css';

const ReinforcementTask = ({ 
  currentQuestion, 
  reinforcementInput, 
  setReinforcementInput, 
  feedback, 
  onSubmit 
}) => (
  <div className="question-container">
    <h1>Reinforcement Task</h1>
    <div className="question-content">
      <p>{currentQuestion.reinforcementTask}</p>
      <div className="answer-area">
        <div className="text-input-container">
          <input
            type="text"
            value={reinforcementInput}
            onChange={(e) => setReinforcementInput(e.target.value)}
            placeholder="Type here"
            className="text-input"
          />
          <button onClick={onSubmit}>Submit</button>
        </div>
        {feedback && (
          <p className={feedback === 'Correct!' ? 'correct-feedback' : 'incorrect-feedback'}>
            {feedback}
          </p>
        )}
      </div>
    </div>
  </div>
);

export default ReinforcementTask;