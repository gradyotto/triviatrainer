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
  onDurationSelect 
}) {
  const durationOptions = [5, 10, 15, 20, 25, 30];

  const handleStart = () => {
    if (selectedCategories.length > 0 && selectedDuration !== null) {
      onStart(selectedDuration);
    }
  };

  return (
    <div className="category-selection">
      <h2>Choose Your Training Categories</h2>
      <div className="categories">
        {categories.map(category => (
          <button
            key={category.id}
            className={`category-button ${selectedCategories.includes(category.id) ? 'selected' : ''}`}
            onClick={() => onCategorySelect(category.id)}
          >
            {category.name}
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
    </div>
  );
}

export default CategorySelection;