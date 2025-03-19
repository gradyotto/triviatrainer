import React from 'react';
import './ModeSelection.css'; // New CSS file

const ModeSelection = ({ onModeSelect }) => (
  <div className="mode-selection">
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