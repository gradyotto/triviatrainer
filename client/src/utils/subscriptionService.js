import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// Define subscription tiers
export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PREMIUM: 'premium',
  PROFESSIONAL: 'professional'
};

// Define features per tier
export const TIER_FEATURES = {
  [SUBSCRIPTION_TIERS.FREE]: {
    name: 'Free',
    maxQuestionsPerSession: 10,
    maxCategories: 3,
    maxSessions: 2,
    spacedRepetition: false,
    customCategories: false,
    price: 0
  },
  [SUBSCRIPTION_TIERS.PREMIUM]: {
    name: 'Premium',
    maxQuestionsPerSession: 50,
    maxCategories: 10,
    maxSessions: 10,
    spacedRepetition: true,
    customCategories: false,
    price: 4.99
  },
  [SUBSCRIPTION_TIERS.PROFESSIONAL]: {
    name: 'Professional',
    maxQuestionsPerSession: 100,
    maxCategories: null, // unlimited
    maxSessions: null, // unlimited
    spacedRepetition: true,
    customCategories: true,
    price: 9.99
  }
};

// Get user's current subscription tier
export const getUserSubscriptionTier = async (userId, db) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.subscriptionTier || SUBSCRIPTION_TIERS.FREE;
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

// Check if user has reached the limit for a given feature
export const checkFeatureLimit = async (userId, limitName, currentValue, db) => {
  try {
    const tier = await getUserSubscriptionTier(userId, db);
    const features = getTierFeatures(tier);
    const limit = features[limitName];
    
    // If limit is null, it means unlimited
    if (limit === null) return { hasReachedLimit: false, limit };
    
    return {
      hasReachedLimit: currentValue >= limit,
      limit
    };
  } catch (error) {
    console.error('Error checking feature limit:', error);
    // Default to the free tier limit as a fallback
    const fallbackLimit = TIER_FEATURES[SUBSCRIPTION_TIERS.FREE][limitName];
    return {
      hasReachedLimit: currentValue >= fallbackLimit,
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

// Track daily usage for limits (like number of sessions)
export const trackDailyUsage = async (userId, usageType, db) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const usageRef = doc(db, `users/${userId}/usage/daily`);
    
    const usageDoc = await getDoc(usageRef);
    let usageData = usageDoc.exists() ? usageDoc.data() : {};
    
    // Initialize or update today's usage
    if (!usageData[today]) {
      usageData[today] = {};
    }
    
    // Increment the specific usage type
    usageData[today][usageType] = (usageData[today][usageType] || 0) + 1;
    
    // Save the updated usage data
    await setDoc(usageRef, usageData);
    
    return usageData[today][usageType];
  } catch (error) {
    console.error(`Error tracking ${usageType} usage:`, error);
    return 1; // Return as if this is the first usage
  }
};

// Get today's usage for a specific feature
export const getTodayUsage = async (userId, usageType, db) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const usageRef = doc(db, `users/${userId}/usage/daily`);
    
    const usageDoc = await getDoc(usageRef);
    let usageData = usageDoc.exists() ? usageDoc.data() : {};
    
    return (usageData[today] && usageData[today][usageType]) || 0;
  } catch (error) {
    console.error(`Error getting ${usageType} usage:`, error);
    return 0;
  }
}; 