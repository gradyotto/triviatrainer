import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import './Profile.css';
import { 
  getUserSubscriptionTier, 
  getSubscriptionDetails, 
  updateSubscription, 
  SUBSCRIPTION_TIERS, 
  TIER_FEATURES 
} from './utils/subscriptionService';

const bannedWords = [
  'fuck', 'shit', 'damn', 'ass', 'bitch', 'cock', 'cunt', 'dick', 'pussy', 'bastard',
  'nigger', 'fag', 'slut', 'whore', 'prick', 'twat', 'arse', 'jerk', 'crap', 'wank'
];

const Profile = ({ user, username: parentUsername, onSignOut, onAdminClick, isAdmin, debugSyncStatus }) => {
  const [username, setUsername] = useState(parentUsername || '');
  const [newUsername, setNewUsername] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);
  const [activityData, setActivityData] = useState({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [subscription, setSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);

  const joinDate = user.metadata?.creationTime 
    ? new Date(user.metadata.creationTime).toLocaleDateString()
    : 'Unknown';

  useEffect(() => {
    setUsername(parentUsername || ''); // Sync with parent username
  }, [parentUsername]);

  useEffect(() => {
    const fetchSubscriptionData = async () => {
      if (!user || !user.uid) return;
      
      try {
        setIsLoading(true);
        // Get subscription details
        const details = await getSubscriptionDetails(user.uid, db);
        setSubscription(details);
      } catch (err) {
        console.error("Failed to fetch subscription data:", err);
        setError("Failed to load subscription information");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSubscriptionData();
  }, [user]);

  useEffect(() => {
    const fetchActivityData = async () => {
      try {
        // Get activity data from the new compressed format
        const spacedDoc = await getDoc(doc(db, `users/${user.uid}/data/spaced`));
        const activity = {};
        
        if (spacedDoc.exists()) {
          const data = spacedDoc.data();
          const questionStates = data.questionStates || {};
          
          // Extract dates from learning data
          Object.values(questionStates).forEach(state => {
            if (state.lrn) {
              const date = new Date(state.lrn).toISOString().split('T')[0];
              activity[date] = (activity[date] || 0) + 1;
            }
          });
          
          // Also include sync timestamps for more complete activity data
          if (data.updates && Array.isArray(data.updates)) {
            data.updates.forEach(update => {
              if (update.ts) {
                const date = new Date(update.ts).toISOString().split('T')[0];
                activity[date] = (activity[date] || 0) + 1;
              }
            });
          }
        }
        
        console.log('Activity data:', activity);
        setActivityData(activity);
      } catch (e) {
        console.error('Error fetching activity data:', e);
        setError('Failed to load activity data. Please try again later.');
        
        // Initialize with empty data to prevent crashes
        setActivityData({});
        
        // If it's a permission error, still allow the component to render
        if (e.code === 'permission-denied') {
          console.log('Permission denied for activity data - using empty dataset');
        }
      }
    };
    fetchActivityData();
  }, [user.uid]);

  const isUsernameValid = (name) => {
    const lowerName = name.toLowerCase().trim();
    return !bannedWords.some(word => lowerName.includes(word)) && /^[a-zA-Z0-9_-]{3,20}$/.test(lowerName);
  };

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    const trimmedUsername = newUsername.trim();
    if (!trimmedUsername) {
      setError('Username cannot be empty');
      return;
    }
    if (!isUsernameValid(trimmedUsername)) {
      setError('Username must be 3-20 characters (letters, numbers, _, -) and not contain offensive words');
      return;
    }
    try {
      await setDoc(doc(db, 'users', user.uid), { 
        username: trimmedUsername,
        created_at: new Date().toISOString()
      }, { merge: true });
      setUsername(trimmedUsername);
      setNewUsername('');
      setIsEditing(false);
      setError(null);
    } catch (e) {
      console.error('Error updating username:', e);
      setError('Failed to update username');
    }
  };

  const handleUpgradeClick = () => {
    setShowSubscriptionModal(true);
    setSelectedTier(null);
    setPaymentSuccess(null);
  };

  const handleTierSelect = (tier) => {
    setSelectedTier(tier);
  };

  const handleSubscribe = async () => {
    if (!selectedTier) {
      setError('Please select a subscription tier');
      return;
    }

    setIsProcessingPayment(true);
    setError(null);

    try {
      // This is a mock payment flow - in a real app, you would integrate with a payment processor
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Process the subscription update
      const result = await updateSubscription(user.uid, selectedTier, db);
      
      if (result.success) {
        setPaymentSuccess({
          tier: selectedTier,
          expiresAt: result.expirationDate
        });
        
        // Update local subscription state
        setSubscription({
          ...subscription,
          tier: selectedTier,
          expirationDate: result.expirationDate,
          autoRenew: true
        });
      } else {
        setError(`Payment failed: ${result.error}`);
      }
    } catch (err) {
      console.error('Error processing subscription:', err);
      setError('An error occurred while processing your payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCloseModal = () => {
    setShowSubscriptionModal(false);
    setSelectedTier(null);
    setPaymentSuccess(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getActivityGraph = () => {
    let maxAttemptsValue = 1;
    if (Object.values(activityData).length > 0) {
      maxAttemptsValue = Math.max(...Object.values(activityData));
    }
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    const daysInMonth = [];
    for (let i = 1; i <= lastOfMonth.getDate(); i++) {
      const date = new Date(year, month, i);
      const isFutureDate = date > currentDate;
      daysInMonth.push({
        date: date,
        dateString: date.toISOString().split('T')[0],
        day: i,
        weekday: date.getDay(),
        isFuture: isFutureDate
      });
    }
    
    const weeks = [];
    let currentWeek = Array(firstOfMonth.getDay()).fill(null);
    
    daysInMonth.forEach(dayInfo => {
      currentWeek.push(dayInfo);
      if (dayInfo.weekday === 6 || dayInfo.day === lastOfMonth.getDate()) {
        while (currentWeek.length < 7) {
          currentWeek.push(null);
        }
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    });
    
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentMonth);
    const today = new Date().toISOString().split('T')[0];

    const goToPreviousMonth = () => {
      setCurrentMonth(new Date(year, month - 1, 1));
    };

    const goToNextMonth = () => {
      const nextMonth = new Date(year, month + 1, 1);
      if (nextMonth <= new Date()) {
        setCurrentMonth(nextMonth);
      }
    };

    const getIntensity = (count) => {
      if (count === 0) return 0;
      const percentage = count / maxAttemptsValue;
      if (percentage <= 0.25) return 1;
      if (percentage <= 0.5) return 2;
      if (percentage <= 0.75) return 3;
      return 4;
    };

    return (
      <div className="activity-section">
        <h2>Your Activity</h2>
        <div className="month-navigation">
          <button onClick={goToPreviousMonth}>←</button>
          <span>{monthName}</span>
          <button 
            onClick={goToNextMonth} 
            disabled={new Date(year, month + 1, 1) > new Date()}
          >→</button>
        </div>
        <div className="activity-graph">
          <div className="weeks-container">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="week">
                {week.map((dayInfo, dayIndex) => {
                  if (dayInfo === null) {
                    return <div key={`empty-${weekIndex}-${dayIndex}`} className="activity-square empty" />;
                  }
                  const count = dayInfo.isFuture ? 0 : (activityData[dayInfo.dateString] || 0);
                  const intensity = getIntensity(count);
                  const isToday = dayInfo.dateString === today;
                  return (
                    <div
                      key={dayInfo.dateString}
                      className={`activity-square intensity-${intensity} ${isToday ? 'today' : ''} ${dayInfo.isFuture ? 'future' : ''}`}
                      title={dayInfo.isFuture ? `${dayInfo.dateString}: Future date` : `${dayInfo.dateString}: ${count} attempts`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="legend">
          <span>Less</span>
          <div className="legend-square intensity-0" />
          <div className="legend-square intensity-1" />
          <div className="legend-square intensity-2" />
          <div className="legend-square intensity-3" />
          <div className="legend-square intensity-4" />
          <span>More</span>
        </div>
      </div>
    );
  };

  // Subscription modal component
  const SubscriptionModal = () => {
    if (!showSubscriptionModal) return null;

    return (
      <div className="modal-overlay">
        <div className="subscription-modal">
          <div className="modal-header">
            <h2>{paymentSuccess ? 'Subscription Updated' : 'Choose Your Subscription'}</h2>
            <button className="close-button" onClick={handleCloseModal}>×</button>
          </div>

          {paymentSuccess ? (
            <div className="payment-success">
              <div className="success-icon">✓</div>
              <h3>Thank you for subscribing!</h3>
              <p>You have successfully subscribed to the {TIER_FEATURES[paymentSuccess.tier].name} plan.</p>
              <p>Your subscription is valid until: {formatDate(paymentSuccess.expiresAt)}</p>
              <button className="primary-button" onClick={handleCloseModal}>Continue</button>
            </div>
          ) : (
            <>
              <div className="subscription-options">
                {Object.keys(TIER_FEATURES).map(tier => (
                  <div 
                    key={tier}
                    className={`subscription-option ${selectedTier === tier ? 'selected' : ''} ${subscription?.tier === tier ? 'current' : ''}`}
                    onClick={() => handleTierSelect(tier)}
                  >
                    <div className="option-header">
                      <h3>{TIER_FEATURES[tier].name}</h3>
                      {subscription?.tier === tier && <span className="current-plan">Current Plan</span>}
                    </div>
                    <div className="option-price">
                      ${TIER_FEATURES[tier].price.toFixed(2)}<span>/month</span>
                    </div>
                    <div className="option-features">
                      <ul>
                        <li>Up to {TIER_FEATURES[tier].maxQuestionsPerSession === null ? 'Unlimited' : TIER_FEATURES[tier].maxQuestionsPerSession} questions per session</li>
                        <li>Up to {TIER_FEATURES[tier].maxCategories === null ? 'Unlimited' : TIER_FEATURES[tier].maxCategories} categories</li>
                        {TIER_FEATURES[tier].sessionsInterval === 'week' ? (
                          <li>Up to {TIER_FEATURES[tier].maxSessions === null ? 'Unlimited' : TIER_FEATURES[tier].maxSessions} sessions per week</li>
                        ) : (
                          <li>Up to {TIER_FEATURES[tier].maxSessions === null ? 'Unlimited' : TIER_FEATURES[tier].maxSessions} sessions per day</li>
                        )}
                        {TIER_FEATURES[tier].maxSessionDuration !== null ? (
                          <li>Maximum {TIER_FEATURES[tier].maxSessionDuration} minute sessions</li>
                        ) : (
                          <li>Unlimited session duration</li>
                        )}
                        <li>{TIER_FEATURES[tier].spacedRepetition ? '✓' : '✗'} Spaced Repetition</li>
                        <li>{TIER_FEATURES[tier].customCategories ? '✓' : '✗'} Custom Categories</li>
                      </ul>
                    </div>
                  </div>
                ))}
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="modal-footer">
                <button 
                  className="primary-button"
                  onClick={handleSubscribe}
                  disabled={isProcessingPayment || !selectedTier || selectedTier === subscription?.tier}
                >
                  {isProcessingPayment ? 'Processing...' : selectedTier === subscription?.tier ? 'Current Plan' : 'Subscribe'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Render subscription information section
  const renderSubscriptionInfo = () => {
    if (isLoading) {
      return <div className="loading-spinner">Loading subscription info...</div>;
    }

    if (!subscription) {
      return <div>Subscription information not available</div>;
    }

    const tierFeatures = TIER_FEATURES[subscription.tier];

    return (
      <div className="subscription-info">
        <div className="subscription-header">
          <h3>Current Subscription: {tierFeatures.name}</h3>
          <button className="upgrade-button" onClick={handleUpgradeClick}>
            {subscription.tier === SUBSCRIPTION_TIERS.FREE ? 'Upgrade' : 'Manage Subscription'}
          </button>
        </div>
        
        {subscription.expirationDate && (
          <p className="expiration-date">
            Valid until: {formatDate(subscription.expirationDate)}
            {subscription.autoRenew && ' (Auto-renews)'}
          </p>
        )}
        
        <div className="plan-features">
          <h4>Your Plan Includes:</h4>
          <ul>
            <li>Up to {tierFeatures.maxQuestionsPerSession === null ? 'Unlimited' : tierFeatures.maxQuestionsPerSession} questions per session</li>
            <li>Up to {tierFeatures.maxCategories === null ? 'Unlimited' : tierFeatures.maxCategories} categories</li>
            {tierFeatures.sessionsInterval === 'week' ? (
              <li>Up to {tierFeatures.maxSessions === null ? 'Unlimited' : tierFeatures.maxSessions} sessions per week</li>
            ) : (
              <li>Up to {tierFeatures.maxSessions === null ? 'Unlimited' : tierFeatures.maxSessions} sessions per day</li>
            )}
            {tierFeatures.maxSessionDuration !== null ? (
              <li>Maximum {tierFeatures.maxSessionDuration} minute sessions</li>
            ) : (
              <li>Unlimited session duration</li>
            )}
            <li>{tierFeatures.spacedRepetition ? '✓' : '✗'} Spaced Repetition</li>
            <li>{tierFeatures.customCategories ? '✓' : '✗'} Custom Categories</li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h1>User Profile</h1>
        <div className="profile-info">
          <p><strong>Username:</strong> {username || 'Not set'}</p>
          {isEditing ? (
            <form onSubmit={handleUsernameSubmit} className="edit-username-form">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter new username"
                maxLength={20}
              />
              <div className="form-buttons">
                <button type="submit">Save</button>
                <button type="button" onClick={() => setIsEditing(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <button className="edit-username-button" onClick={() => setIsEditing(true)}>Edit Username</button>
          )}
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Joined:</strong> {joinDate}</p>
          <p><strong>Stats:</strong> Coming soon! (Questions answered, accuracy, etc.)</p>
        </div>
        {error && <p className="error">{error}</p>}
        
        {/* Subscription information */}
        {renderSubscriptionInfo()}
        
        {/* Activity graph */}
        {getActivityGraph()}
        
        <button className="sign-out-button" onClick={onSignOut}>Sign Out</button>
        {isAdmin && <button className="admin-button" onClick={onAdminClick}>Admin Panel</button>}
      </div>
      
      {/* Subscription modal */}
      <SubscriptionModal />
    </div>
  );
};

export default Profile;