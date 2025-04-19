import React, { useState } from 'react';
import './CategorySelection.css';

function CategorySelection({ 
  mode, 
  categories, 
  selectedCategories, 
  onCategorySelect, 
  onStart, 
  error, 
  selectedDuration, 
  onDurationSelect,
  spacedRepetitionEnabled,
  onToggleSpacedRepetition,
  dueQuestions,
  questionPriorities,
  dueQuestionsByCategory
}) {
  const durationOptions = [5, 10, 15, 20, 25, 30];
  const [showHelp, setShowHelp] = useState(false);

  const handleStart = () => {
    if (selectedCategories.length > 0 && selectedDuration !== null) {
      onStart(selectedDuration);
    }
  };

  // Count due questions per category more accurately
  const getDueQuestionCount = (categoryId) => {
    if (!spacedRepetitionEnabled || !dueQuestionsByCategory) return 0;
    
    const categoryDueQuestions = dueQuestionsByCategory[categoryId] || [];
    return categoryDueQuestions.length;
  };

  const totalDueQuestions = dueQuestions?.length || 0;

  // Toggle help popup
  const toggleHelp = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowHelp(!showHelp);
  };

  return (
    <div className="category-selection">
      <h2>Choose Your Training Categories</h2>
      
      {/* Spaced Repetition Toggle with Help Icon */}
      {spacedRepetitionEnabled !== undefined && (
        <div className="spaced-repetition-toggle">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={spacedRepetitionEnabled}
              onChange={() => onToggleSpacedRepetition(!spacedRepetitionEnabled)}
            />
            <span className="toggle-slider"></span>
          </label>
          <span className="toggle-label">
            Spaced Repetition {spacedRepetitionEnabled ? 'Enabled' : 'Disabled'}
            {spacedRepetitionEnabled && totalDueQuestions > 0 && (
              <span className="due-badge">{totalDueQuestions} due</span>
            )}
          </span>
          <button 
            className="help-icon"
            onClick={toggleHelp}
            aria-label="Spaced repetition help"
          >
            ?
          </button>
          
          {/* Help Popup */}
          {showHelp && (
            <div className="help-popup">
              <div className="help-popup-content">
                <h3>About Spaced Repetition</h3>
                <p>
                  <strong>What is it?</strong> Spaced repetition is a learning technique that spaces out review
                  of material over time to improve long-term retention.
                </p>
                <h4>How it works in TriviaTrainer:</h4>
                <ul>
                  <li>
                    <strong>Question Scheduling:</strong> Questions you answer correctly are shown less frequently,
                    while questions you struggle with appear more often.
                  </li>
                  <li>
                    <strong>Priority Score (0-100%):</strong> Each question is assigned a priority based on:
                    <ul>
                      <li>How often you've answered it correctly (lower priority if consistently correct)</li>
                      <li>How recently you've seen it (lower priority for recently seen questions)</li>
                      <li>Whether it's due for review (higher priority if due or overdue)</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Due Questions:</strong> Questions become "due" for review based on a scientific algorithm:
                    <ul>
                      <li>After 1 correct answer: Review in 1 day</li>
                      <li>After 2 consecutive correct answers: Review in 3 days</li>
                      <li>After 3 consecutive correct answers: Review in 7 days</li>
                      <li>And so on, with longer intervals as you demonstrate mastery</li>
                    </ul>
                  </li>
                </ul>
                <p><strong>High Priority (70-100%):</strong> Questions you need urgent review on.</p>
                <p><strong>Medium Priority (40-69%):</strong> Questions you're learning but still need practice with.</p>
                <p><strong>Low Priority (0-39%):</strong> Questions you've mastered.</p>
                <button onClick={toggleHelp} className="close-help">Close</button>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="categories">
        {categories.map(category => (
          <button
            key={category.id}
            className={`category-button ${selectedCategories.includes(category.id) ? 'selected' : ''}`}
            onClick={() => onCategorySelect(category.id)}
          >
            {category.name}
            {spacedRepetitionEnabled && getDueQuestionCount(category.id) > 0 && (
              <span className="category-due-badge">{getDueQuestionCount(category.id)} due</span>
            )}
          </button>
        ))}
      </div>
      <div className="duration-selection">
        <h3>How long would you like to train?</h3>
        <div className="duration-buttons">
          <button
            className={`duration-button test-button ${selectedDuration === 0.08 ? 'selected' : ''}`}
            onClick={() => onDurationSelect(0.08)}
          >
            5 sec (test)
          </button>
          {durationOptions.map(min => (
            <button
              key={min}
              className={`duration-button ${selectedDuration === min ? 'selected' : ''}`}
              onClick={() => onDurationSelect(min)}
            >
              {min} min
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error">Oops! {error}</p>}
      <button
        className="start-button"
        onClick={handleStart}
        disabled={selectedCategories.length === 0 || selectedDuration === null}
      >
        Begin Training
      </button>
      
      {spacedRepetitionEnabled && (
        <div className="spaced-repetition-info">
          <p>
            With spaced repetition enabled, the system will prioritize questions that you need to review 
            based on your past performance. Questions you find difficult will appear more frequently.
          </p>
        </div>
      )}
    </div>
  );
}

export default CategorySelection;