import React from 'react';
import './CategorySelection.css'; // New CSS file

const CategorySelection = ({ mode, categories, selectedCategories, onCategorySelect, onStart, onRandomCategory, fetchQuestions, error }) => (
  <div className="category-selection">
    <h1>TriviaTrainer - {mode === 'quiz' ? 'Quiz Mode' : 'Training Mode'}</h1>
    <h2>{mode === 'quiz' ? 'Select a Category' : 'Select Categories'}</h2>
    <div className="category-grid">
      {mode === 'quiz' && (
        <button onClick={onRandomCategory} className="category-button random-category">
          Random Category
        </button>
      )}
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => {
            onCategorySelect(cat.id);
            if (mode === 'quiz') fetchQuestions([cat.id]);
          }}
          className={`category-button ${selectedCategories.includes(cat.id) ? 'selected' : ''}`}
        >
          {cat.name}
        </button>
      ))}
    </div>
    {mode === 'training' && (
      <button onClick={onStart} disabled={!selectedCategories.length} className="start-button">
        Start Training
      </button>
    )}
    {error && <p style={{ color: 'red' }}>{error}</p>}
  </div>
);

export default CategorySelection;