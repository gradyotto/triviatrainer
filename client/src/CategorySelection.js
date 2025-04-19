import React from 'react';
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
  questionPriorities
}) {
  const durationOptions = [5, 10, 15, 20, 25, 30];

  const handleStart = () => {
    if (selectedCategories.length > 0 && selectedDuration !== null) {
      onStart(selectedDuration);
    }
  };

  // Count due questions per category
  const getDueQuestionCount = (categoryId) => {
    if (!dueQuestions || !dueQuestions.length) return 0;
    
    const categoryQuestions = dueQuestions.filter(questionId => {
      // Since we don't have direct access to question categories here,
      // we're just counting total due questions
      return true;
    });
    
    return categoryQuestions.length;
  };

  const totalDueQuestions = dueQuestions?.length || 0;

  return (
    <div className="category-selection">
      <h2>Choose Your Training Categories</h2>
      
      {/* Spaced Repetition Toggle */}
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