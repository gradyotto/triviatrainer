import React, { useState, useEffect } from 'react';
import './ReinforcementTask.css';

const ReinforcementTask = ({ 
  currentQuestion, 
  reinforcementInput, 
  setReinforcementInput, 
  feedback, 
  onSubmit 
}) => {
  // Use local state to prevent focus loss when typing
  const [localInput, setLocalInput] = useState(reinforcementInput);
  
  // Sync local input with parent state when reinforcementInput changes from parent
  useEffect(() => {
    setLocalInput(reinforcementInput);
  }, [reinforcementInput]);
  
  // Handle local input change
  const handleInputChange = (e) => {
    setLocalInput(e.target.value);
  };
  
  // When submitting, update parent state and call onSubmit
  const handleSubmit = () => {
    // Update parent state
    setReinforcementInput(localInput);
    // Pass the local input directly to the parent's onSubmit
    onSubmit(localInput);
  };

  return (
    <div className="question-container">
      <h1>Reinforcement Task</h1>
      <div className="question-content">
        <p>{currentQuestion.reinforcementTask}</p>
        <div className="answer-area">
          <div className="text-input-container">
            <input
              type="text"
              id="reinforcement-input"
              name="reinforcement-input"
              value={localInput}
              onChange={handleInputChange}
              placeholder="Type here"
              className="text-input"
            />
            <button onClick={handleSubmit}>Submit</button>
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
};

export default ReinforcementTask;