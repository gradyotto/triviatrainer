import React, { useState, useEffect } from 'react';
import './CategorySelection.css';
import { SUBSCRIPTION_TIERS, TIER_FEATURES } from './utils/subscriptionService';

const CategorySelection = ({ 
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
  dueQuestions = [],
  questionPriorities = {},
  dueQuestionsByCategory = {},
  isAdmin = false,
  subscriptionTier = SUBSCRIPTION_TIERS.FREE,
  tierFeatures = TIER_FEATURES[SUBSCRIPTION_TIERS.FREE]
}) => {
  const [localError, setLocalError] = useState(null);
  const [maxCategoriesMessage, setMaxCategoriesMessage] = useState(false);

  // Show category limit message when needed
  useEffect(() => {
    if (maxCategoriesMessage) {
      const timer = setTimeout(() => {
        setMaxCategoriesMessage(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [maxCategoriesMessage]);

  const handleStart = () => {
    if (selectedCategories.length === 0) {
      setLocalError("Please select at least one category.");
      return;
    }
    if (!selectedDuration) {
      setLocalError("Please select a duration.");
      return;
    }
    setLocalError(null);
    onStart();
  };
  
  // Add a specific handler for the spaced repetition toggle
  const handleSpacedRepetitionToggle = () => {
    if (tierFeatures?.spacedRepetition) {
      onToggleSpacedRepetition(!spacedRepetitionEnabled);
    }
  };

  // Count due questions per category
  const getDueQuestionCount = (categoryId) => {
    if (!spacedRepetitionEnabled || !dueQuestionsByCategory) {
      return 0;
    }
    
    const categoryDueQuestions = dueQuestionsByCategory[categoryId] || [];
    return categoryDueQuestions.length;
  };

  // New function to handle category button clicks with limit logic  
  const handleCategoryButtonClick = (categoryId, isDisabled) => {
    if (isDisabled) {
      // Show upgrade modal with appropriate message
      const message = `You've reached the limit of ${tierFeatures.maxCategories} categories for your current subscription tier.`;
      // Call the parent's onCategorySelect with a special flag to show the modal
      onCategorySelect(categoryId, true); // Pass true to indicate this is a limit-exceeded click
    } else {
      // Normal select/deselect behavior
      onCategorySelect(categoryId);
    }
  };

  const totalDueQuestions = dueQuestions?.length || 0;

  return (
    <div className="category-selection">
      <h2>Choose Your Training Categories</h2>
      
      {/* Subscription tier info - keep this from the new version */}
      <div className="subscription-info-bar">
        <div className="subscription-status">
          {subscriptionTier === SUBSCRIPTION_TIERS.PREMIUM ? (
            <span className="tier-badge premium">Premium</span>
          ) : subscriptionTier === SUBSCRIPTION_TIERS.PROFESSIONAL ? (
            <span className="tier-badge professional">Professional</span>
          ) : (
            <span className="tier-badge free">Free</span>
          )}
          <span className="remaining-sessions">
            {tierFeatures?.maxSessions === null 
              ? "Unlimited sessions available" 
              : `Up to ${tierFeatures?.maxSessions} sessions per day`}
          </span>
        </div>
        <a href="/profile" className="upgrade-link">
          {subscriptionTier === SUBSCRIPTION_TIERS.FREE ? 'Upgrade' : 'Manage Subscription'}
        </a>
      </div>
      
      {/* Category selection limit notice */}
      <p className="category-limit-info">
        Select up to {tierFeatures?.maxCategories === null ? 'unlimited' : tierFeatures?.maxCategories} categories
      </p>
      
      {/* Max Categories Message */}
      {maxCategoriesMessage && (
        <div className="max-categories-message">
          Maximum of {tierFeatures?.maxCategories} categories allowed. Please deselect a category first.
        </div>
      )}
      
      {/* Spaced Repetition Toggle - Fixed toggle functionality */}
      {spacedRepetitionEnabled !== undefined && (
        <div className="spaced-repetition-toggle">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={spacedRepetitionEnabled}
              onChange={handleSpacedRepetitionToggle}
              disabled={!tierFeatures?.spacedRepetition}
            />
            <span className="toggle-slider"></span>
          </label>
          <span className="toggle-label">
            Spaced Repetition {spacedRepetitionEnabled ? 'Enabled' : 'Disabled'}
            {spacedRepetitionEnabled && totalDueQuestions > 0 && (
              <span className="due-badge">{totalDueQuestions} due</span>
            )}
          </span>
          {!tierFeatures?.spacedRepetition && (
            <span className="feature-lock-info">
              <span className="lock-icon">🔒</span>
              <span>Upgrade to unlock</span>
            </span>
          )}
        </div>
      )}
      
      {/* Categories Grid - restored to original style */}
      <div className="categories">
        {categories.map(category => {
          const isSelected = selectedCategories.includes(category.id);
          // Only disable buttons when we've EXACTLY reached the maximum limit (not before)
          const isDisabled = !isSelected && tierFeatures?.maxCategories !== null && selectedCategories.length >= tierFeatures?.maxCategories;
          const dueCount = getDueQuestionCount(category.id);
          
          return (
            <button
              key={category.id}
              className={`category-button ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
              onClick={() => handleCategoryButtonClick(category.id, isDisabled)}
              // Remove the disabled attribute so the button remains clickable
            >
              {category.name}
              {spacedRepetitionEnabled && dueCount > 0 && (
                <span className="category-due-badge">{dueCount} due</span>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Duration Selection */}
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
          <button
            className={`duration-button ${selectedDuration === 5 ? 'selected' : ''}`}
            onClick={() => onDurationSelect(5)}
          >
            5 min
          </button>
          <button
            className={`duration-button ${selectedDuration === 10 ? 'selected' : ''}`}
            onClick={() => onDurationSelect(10)}
          >
            10 min
          </button>
          <button
            className={`duration-button ${selectedDuration === 15 ? 'selected' : ''}`}
            onClick={() => onDurationSelect(15)}
          >
            15 min
          </button>
        </div>
      </div>
      
      {/* Question limit info from subscription features */}
      <div className="question-limit-info">
        <span>Session question limit: {tierFeatures?.maxQuestionsPerSession === null ? 'Unlimited' : tierFeatures?.maxQuestionsPerSession} questions</span>
      </div>
      
      {(error || localError) && <p className="error">Oops! {error || localError}</p>}
      
      {/* Begin Training button with correct styling */}
      <div className="start-button-container">
        <button
          className="start-button"
          onClick={handleStart}
          disabled={selectedCategories.length === 0 || !selectedDuration}
        >
          Begin Training
        </button>
      </div>
      
      {spacedRepetitionEnabled && (
        <div className="spaced-repetition-info">
          <p>
            With spaced repetition enabled, the system will prioritize questions that you need to review 
            based on your past performance. Questions you find difficult will appear more frequently. 
            The more you train, the better Trivia will get!
          </p>
        </div>
      )}
    </div>
  );
};

export default CategorySelection;