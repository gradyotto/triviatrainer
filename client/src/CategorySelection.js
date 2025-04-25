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
  dueQuestionsByCategory,
  isAdmin
}) {
  const durationOptions = [5, 10, 15];
  const [showHelp, setShowHelp] = useState(false);
  const [maxCategoriesMessage, setMaxCategoriesMessage] = useState(false);
  
  const handleStart = () => {
    console.log('Begin Training clicked');
    if (selectedCategories.length > 0 && selectedDuration !== null) {
      console.log('Starting training with duration:', selectedDuration);
      onStart(selectedDuration);
    }
  };

  // Count due questions per category more accurately
  const getDueQuestionCount = (categoryId) => {
    if (!spacedRepetitionEnabled || !dueQuestionsByCategory) {
      return 0;
    }
    
    const categoryDueQuestions = dueQuestionsByCategory[categoryId] || [];
    return categoryDueQuestions.length;
  };

  const totalDueQuestions = dueQuestions?.length || 0;

  const handleCategorySelect = (categoryId) => {
    // If category is already selected, allow deselection
    if (selectedCategories.includes(categoryId)) {
      onCategorySelect(categoryId);
      return;
    }
    
    // If not already selected, only allow selection if fewer than 3 categories are selected
    if (selectedCategories.length < 3) {
      onCategorySelect(categoryId);
    } else {
      // Show the max categories message
      setMaxCategoriesMessage(true);
      
      // Hide the message after 3 seconds
      setTimeout(() => {
        setMaxCategoriesMessage(false);
      }, 3000);
    }
  };

  return (
    <div 
      className="category-selection" 
      style={{ 
        overflow: 'hidden',
        maxHeight: '100vh',
        overscrollBehavior: 'none'
      }}
    >
      <h2>Choose Your Training Categories</h2>
      
      {/* Category Selection Limit Notice */}
      <p className="category-limit-notice">Select up to 3 categories</p>
      
      {/* Max Categories Message */}
      {maxCategoriesMessage && (
        <div className="max-categories-message">
          Maximum of 3 categories allowed. Please deselect a category first.
        </div>
      )}
      
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
        {categories.map(category => {
          const isSelected = selectedCategories.includes(category.id);
          const isDisabled = !isSelected && selectedCategories.length >= 3;
          return (
            <button
              key={category.id}
              className={`category-button ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
              onClick={() => handleCategorySelect(category.id)}
              disabled={isDisabled}
            >
              {category.name}
              {spacedRepetitionEnabled && getDueQuestionCount(category.id) > 0 && (
                <span className="category-due-badge">{getDueQuestionCount(category.id)} due</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="duration-selection">
        <h3>How long would you like to train?</h3>
        <div className="duration-buttons">
          {isAdmin && (
            <button
              className={`duration-button test-button ${selectedDuration === 0.08 ? 'selected' : ''}`}
              onClick={() => onDurationSelect(0.08)}
            >
              5 sec (test)
            </button>
          )}
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
            based on your past performance. Questions you find difficult will appear more frequently. The more you train, the better Trivia will get!
          </p>
        </div>
      )}
    </div>
  );
}

export default CategorySelection;