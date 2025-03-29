import React, { useState } from 'react';
import './CategorySelection.css';

function CategorySelection({ mode, categories, selectedCategories, onCategorySelect, onStart, error }) {
  const [duration, setDuration] = useState(null); // No default, forces selection
  const durationOptions = [5, 10, 15, 20, 25, 30];

  const handleStart = () => {
    if (selectedCategories.length > 0 && duration !== null) {
      onStart(duration);
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
          {durationOptions.map(min => (
            <button
              key={min}
              className={`duration-button ${duration === min ? 'selected' : ''}`}
              onClick={() => setDuration(min)}
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
        disabled={selectedCategories.length === 0 || duration === null}
      >
        Begin Training
      </button>
    </div>
  );
}

export default CategorySelection;