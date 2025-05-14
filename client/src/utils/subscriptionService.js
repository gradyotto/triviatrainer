import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// Define subscription tiers
export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PRO: 'pro'
};

// Define features per tier
export const TIER_FEATURES = {
  [SUBSCRIPTION_TIERS.FREE]: {
    name: 'Free',
    maxQuestionsPerSession: null, // Unlimited questions
    maxCategories: 3,
    maxSessions: 5, // 5 sessions per week
    maxSessionDuration: 5, // Only 5 minute sessions
    sessionsInterval: 'week', // Track weekly instead of daily
    spacedRepetition: false,
    customCategories: false,
    premiumCategories: [], // No premium categories for free tier
    price: 0
  },
  [SUBSCRIPTION_TIERS.PRO]: {
    name: 'Pro',
    maxQuestionsPerSession: null, // Unlimited questions
    maxCategories: null, // unlimited
    maxSessions: null, // unlimited
    maxSessionDuration: null, // Any duration
    sessionsInterval: 'day', // Daily tracking
    spacedRepetition: true,
    customCategories: true,
    premiumCategories: ['Current Events'], // Premium categories only for Pro tier
    price: 4.99
  }
};

// Get user's current subscription tier
export const getUserSubscriptionTier = async (userId, db) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      // Handle legacy subscription tiers
      let tier = userData.subscriptionTier || SUBSCRIPTION_TIERS.FREE;
      
      // Check if tier needs migration
      if (tier === 'premium' || tier === 'professional') {
        // Call migration function to update database
        tier = await migrateSubscriptionTier(userId, tier, db);
      }
      
      return tier;
    }
    return SUBSCRIPTION_TIERS.FREE;
  } catch (error) {
    console.error('Error getting user subscription tier:', error);
    return SUBSCRIPTION_TIERS.FREE;
  }
};

// Get features available for a given tier
export const getTierFeatures = (tier) => {
  return TIER_FEATURES[tier] || TIER_FEATURES[SUBSCRIPTION_TIERS.FREE];
};

// Check if the user has access to a specific feature
export const hasFeatureAccess = async (userId, feature, db) => {
  try {
    const tier = await getUserSubscriptionTier(userId, db);
    const features = getTierFeatures(tier);
    return !!features[feature];
  } catch (error) {
    console.error('Error checking feature access:', error);
    return false;
  }
};

// Track daily or weekly usage of features
export const trackDailyUsage = async (userId, featureType, db) => {
  try {
    const usageRef = doc(db, `users/${userId}/usage/${featureType}`);
    const usageDoc = await getDoc(usageRef);
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Get the start of the current week (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Go back to Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    const weekStr = startOfWeek.toISOString().split('T')[0]; // YYYY-MM-DD of Sunday
    
    let usageData = usageDoc.exists() ? usageDoc.data() : { daily: {}, weekly: {} };
    
    // Initialize if not exists
    if (!usageData.daily) usageData.daily = {};
    if (!usageData.weekly) usageData.weekly = {};
    
    // Update daily count
    usageData.daily[todayStr] = (usageData.daily[todayStr] || 0) + 1;
    
    // Update weekly count
    usageData.weekly[weekStr] = (usageData.weekly[weekStr] || 0) + 1;
    
    // Save to Firestore
    await setDoc(usageRef, usageData);
    
    return {
      daily: usageData.daily[todayStr],
      weekly: usageData.weekly[weekStr]
    };
  } catch (error) {
    console.error('Error tracking usage:', error);
    return { daily: 0, weekly: 0 };
  }
};

// Get usage for today or current week
export const getTodayUsage = async (userId, featureType, db) => {
  try {
    const usageRef = doc(db, `users/${userId}/usage/${featureType}`);
    const usageDoc = await getDoc(usageRef);
    
    if (!usageDoc.exists()) return 0;
    
    const usageData = usageDoc.data();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Get the start of the current week (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Go back to Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    const weekStr = startOfWeek.toISOString().split('T')[0]; // YYYY-MM-DD of Sunday
    
    // Return daily or weekly count based on user's tier
    return {
      daily: usageData.daily?.[todayStr] || 0,
      weekly: usageData.weekly?.[weekStr] || 0
    };
  } catch (error) {
    console.error('Error getting usage:', error);
    return { daily: 0, weekly: 0 };
  }
};

// Check if user has reached the limit for a given feature
export const checkFeatureLimit = async (userId, limitName, currentValue, db) => {
  try {
    const tier = await getUserSubscriptionTier(userId, db);
    const features = getTierFeatures(tier);
    const limit = features[limitName];
    
    // If limit is null, it means unlimited
    if (limit === null) return { hasReachedLimit: false, limit };
    
    // For session limits, check if we need to use weekly or daily tracking
    if (limitName === 'maxSessions' && features.sessionsInterval) {
      const usage = await getTodayUsage(userId, 'sessions', db);
      const interval = features.sessionsInterval;
      const currentUsage = interval === 'week' ? usage.weekly : usage.daily;
      
      return {
        hasReachedLimit: currentUsage >= limit,
        limit,
        interval
      };
    }
    
    // For duration limits, check if the selected duration exceeds the max
    if (limitName === 'maxSessionDuration') {
      return {
        hasReachedLimit: currentValue > limit,
        limit
      };
    }
    
    // For other features, compare directly with the current value
    return {
      hasReachedLimit: currentValue > limit,
      limit
    };
  } catch (error) {
    console.error('Error checking feature limit:', error);
    // Default to the free tier limit as a fallback
    const fallbackLimit = TIER_FEATURES[SUBSCRIPTION_TIERS.FREE][limitName];
    return {
      hasReachedLimit: currentValue > fallbackLimit,
      limit: fallbackLimit
    };
  }
};

// Get subscription details including expiration date
export const getSubscriptionDetails = async (userId, db) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        tier: userData.subscriptionTier || SUBSCRIPTION_TIERS.FREE,
        expirationDate: userData.subscriptionExpiration || null,
        paymentMethod: userData.paymentMethod || null,
        autoRenew: userData.autoRenew || false
      };
    }
    return {
      tier: SUBSCRIPTION_TIERS.FREE,
      expirationDate: null,
      paymentMethod: null,
      autoRenew: false
    };
  } catch (error) {
    console.error('Error getting subscription details:', error);
    return {
      tier: SUBSCRIPTION_TIERS.FREE,
      expirationDate: null,
      paymentMethod: null,
      autoRenew: false
    };
  }
};

// Mock function to update user's subscription (would connect to a payment processor in production)
export const updateSubscription = async (userId, tier, db) => {
  try {
    // Calculate expiration date (one month from now)
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 1);
    
    // Update user document with new subscription info
    await updateDoc(doc(db, 'users', userId), {
      subscriptionTier: tier,
      subscriptionExpiration: expirationDate.toISOString(),
      autoRenew: true,
      subscriptionUpdatedAt: new Date().toISOString()
    });
    
    return {
      success: true,
      tier,
      expirationDate: expirationDate.toISOString()
    };
  } catch (error) {
    console.error('Error updating subscription:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Function to migrate users from old subscription tiers to new ones
export const migrateSubscriptionTier = async (userId, oldTier, db) => {
  if (!userId || !db) return;
  
  try {
    // Only migrate if the old tier is premium or professional
    if (oldTier === 'premium' || oldTier === 'professional') {
      console.log(`Migrating user ${userId} from ${oldTier} to ${SUBSCRIPTION_TIERS.PRO}`);
      
      await updateDoc(doc(db, 'users', userId), {
        subscriptionTier: SUBSCRIPTION_TIERS.PRO,
        subscriptionMigratedAt: new Date().toISOString(),
        subscriptionMigratedFrom: oldTier
      });
      
      return SUBSCRIPTION_TIERS.PRO;
    }
    
    return oldTier;
  } catch (error) {
    console.error('Error migrating subscription tier:', error);
    return oldTier;
  }
}; 