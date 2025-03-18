import React from 'react';

const ModeSelection = ({ onModeSelect }) => (
  <div>
    <h1>TriviaTrainer</h1>
    <h2>Choose Your Mode</h2>
    <div className="mode-buttons">
      <button onClick={() => onModeSelect('training')} className="mode-button">
        Training Mode
      </button>
      <button onClick={() => onModeSelect('quiz')} className="mode-button">
        Quiz Mode
      </button>
    </div>
  </div>
);

export default ModeSelection;