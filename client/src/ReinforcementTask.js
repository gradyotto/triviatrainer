import React from 'react';

const ReinforcementTask = ({ currentQuestion, reinforcementInput, setReinforcementInput, feedback, onSubmit }) => (
  <div>
    <h1>Reinforcement Task</h1>
    <p>{currentQuestion.reinforcementTask}</p>
    <input
      type="text"
      value={reinforcementInput}
      onChange={(e) => setReinforcementInput(e.target.value)}
      placeholder="Type here"
    />
    <button onClick={onSubmit}>Submit</button>
    {feedback && (
      <p className={feedback === 'Correct!' ? 'correct-feedback' : 'incorrect-feedback'}>
        {feedback}
      </p>
    )}
  </div>
);

export default ReinforcementTask;