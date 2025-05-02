import React, { useState } from 'react';
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

  const handleSpacedRepetitionToggle = () => {
    onToggleSpacedRepetition(!spacedRepetitionEnabled);
  };

  // Get the number of due questions for selected categories
  const getSelectedDueCount = () => {
    if (!selectedCategories || selectedCategories.length === 0) return 0;
    
    let count = 0;
    selectedCategories.forEach(category => {
      if (dueQuestionsByCategory[category]) {
        count += dueQuestionsByCategory[category].length;
      }
    });
    return count;
  };

  // Function to get tier badge icon/text
  const getTierBadge = () => {
    switch(subscriptionTier) {
      case SUBSCRIPTION_TIERS.PREMIUM:
        return <span className="tier-badge premium">Premium</span>;
      case SUBSCRIPTION_TIERS.PROFESSIONAL:
        return <span className="tier-badge professional">Professional</span>;
      default:
        return <span className="tier-badge free">Free</span>;
    }
  };

  // Calculate remaining sessions if applicable
  const getRemainingSessionsText = () => {
    if (!tierFeatures) return null;
    
    const maxSessions = tierFeatures.maxSessions;
    if (maxSessions === null) return "Unlimited sessions available";
    
    // For the MVP, we're not tracking actual usage yet, so just show the max
    return `Up to ${maxSessions} sessions per day`;
  };

  return (
    <div className="category-selection">
      <h1>{mode === 'training' ? 'Choose Your Categories' : 'Review Due Questions'}</h1>
      
      {/* Subscription tier info */}
      <div className="subscription-info-bar">
        <div className="subscription-status">
          {getTierBadge()}
          <span className="remaining-sessions">{getRemainingSessionsText()}</span>
        </div>
        <a href="/profile" className="upgrade-link">
          {subscriptionTier === SUBSCRIPTION_TIERS.FREE ? 'Upgrade' : 'Manage Subscription'}
        </a>
      </div>
      
      <div className="category-grid">
        {categories.map(category => {
          const isSelected = selectedCategories.includes(category.id);
          const dueCount = dueQuestionsByCategory[category.id]?.length || 0;
          const hasOverdueQuestions = dueCount > 0;
          
          return (
            <div 
              key={category.id}
              className={`category-card ${isSelected ? 'selected' : ''} ${hasOverdueQuestions ? 'has-due' : ''}`}
              onClick={() => onCategorySelect(category.id)}
            >
              <h3>{category.name}</h3>
              {hasOverdueQuestions && (
                <div className="due-badge">{dueCount}</div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Category selection limit info */}
      <div className="selection-limit-info">
        Selected: {selectedCategories.length} / {tierFeatures?.maxCategories === null ? '∞' : tierFeatures?.maxCategories}
      </div>
      
      <div className="options-container">
        <h2>Session Options</h2>
        
        <div className="duration-selector">
          <h3>Duration</h3>
          <div className="duration-buttons">
            <button 
              className={selectedDuration === 5 ? 'selected' : ''}
              onClick={() => onDurationSelect(5)}
            >
              5 min
            </button>
            <button 
              className={selectedDuration === 10 ? 'selected' : ''}
              onClick={() => onDurationSelect(10)}
            >
              10 min
            </button>
            <button 
              className={selectedDuration === 15 ? 'selected' : ''}
              onClick={() => onDurationSelect(15)}
            >
              15 min
            </button>
            <button 
              className={selectedDuration === 30 ? 'selected' : ''}
              onClick={() => onDurationSelect(30)}
            >
              30 min
            </button>
          </div>
        </div>
        
        <div className="spaced-repetition-toggle">
          <label className="toggle-container">
            <span>Spaced Repetition</span>
            <div className={`toggle ${spacedRepetitionEnabled ? 'on' : 'off'} ${!tierFeatures?.spacedRepetition ? 'disabled' : ''}`}>
              <input 
                type="checkbox" 
                checked={spacedRepetitionEnabled} 
                onChange={handleSpacedRepetitionToggle} 
                disabled={!tierFeatures?.spacedRepetition}
              />
              <span className="slider"></span>
            </div>
          </label>
          {!tierFeatures?.spacedRepetition && 
            <div className="feature-lock-info">
              <span className="lock-icon">🔒</span>
              <span>Upgrade to unlock Spaced Repetition</span>
            </div>
          }
          
          {spacedRepetitionEnabled && (
            <div className="due-info">
              <span>{getSelectedDueCount()} questions due in selected categories</span>
              <span>{dueQuestions.length} questions due in total</span>
            </div>
          )}
        </div>
        
        <div className="question-limit-info">
          <span>Session question limit: {tierFeatures?.maxQuestionsPerSession === null ? 'Unlimited' : tierFeatures?.maxQuestionsPerSession} questions</span>
        </div>
      </div>
      
      {(error || localError) && <div className="error-message">{error || localError}</div>}
      
      <button 
        className={`start-button ${selectedCategories.length === 0 || !selectedDuration ? 'disabled' : ''}`} 
        onClick={handleStart}
        disabled={selectedCategories.length === 0 || !selectedDuration}
      >
        Start Session
      </button>
    </div>
  );
};

export default CategorySelection;