import React, { useState, useEffect, useRef } from 'react';
import { auth, functions } from './firebase';
import { signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, browserLocalPersistence, browserSessionPersistence, setPersistence } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import './LandingPage.css';

const triviaFacts = [
  "The Great Wall of China is not visible from space with the naked eye",
  "A group of flamingos is called a flamboyance",
  "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old",
  "Octopuses have three hearts",
  "Maine is the only U.S. state with a one-syllable name",
  "Venus rotates in the opposite direction to most planets",
  "The shortest war in history was between Britain and Zanzibar in 1896. It lasted just 38 minutes",
  "The world's oldest known living tree is over 5,000 years old",
  "A day on Venus is longer than a year on Venus",
  "Bananas are berries, but strawberries aren't",
  "An ostrich's eye is bigger than its brain",
  "The Eiffel Tower can be 15 cm taller during the summer due to thermal expansion",
  "Cows have best friends and get stressed when separated",
  "The fingerprints of koalas are so similar to humans that they have on occasion been confused at crime scenes",
  "The Hawaiian alphabet has only 13 letters",
  "Australia is wider than the moon",
  "Polar bears' fur is not white—it's actually transparent and reflects light",
  "The original name for the search engine Google was Backrub",
  "A bolt of lightning is five times hotter than the surface of the sun",
  "The shortest commercial flight in the world takes just 1.7 minutes",
  "A jiffy is an actual unit of time: 1/100th of a second",
  "The human body contains about 0.2 milligrams of gold, most of it in the blood",
  "Cleopatra lived closer in time to the moon landing than to the building of the Great Pyramids",
  "A single cloud can weigh more than a million pounds",
  "Sharks possess an acute sense of smell, detecting blood in the water from miles away",
  "The first computer 'bug' was an actual insect stuck in a relay",
  "There are more stars in the universe than grains of sand on all the Earth's beaches",
  "A hummingbird weighs less than a penny",
  "The shortest bone in the human body is in the ear, called the stapes",
  "A group of crows is called a murder",
  "The Vatican, Disney World, and Russia all have their own official calendars",
  "A blue whale's tongue weighs as much as an elephant",
  "The inventor of the frisbee was turned into a frisbee after he died",
  "Wombat poop is cube-shaped",
  "The first oranges weren't orange—they were green",
  "A group of pandas is called an embarrassment",
  "The unicorn is Scotland's national animal",
  "There's a species of spider called the Hobo Spider",
  "A snail can sleep for three years",
  "The smell of rain is caused by bacteria in the soil",
  "The longest place name in the world has 85 letters",
  "A group of porcupines is called a prickle",
  "The first computer mouse was made of wood",
  "A crocodile cannot stick its tongue out",
  "The world's largest desert isn't the Sahara—it's Antarctica",
  "A group of rhinos is called a crash",
  "The first alarm clock could only ring at 4 a.m.",
  "A cat's nose print is unique, like a human fingerprint",
  "The deepest part of the ocean is over 36,000 feet deep",
  "A group of jellyfish is called a smack",
  "The first email was sent in 1971",
  "A shrimp's heart is in its head"
];

const MAX_RECENT_FACTS = 10;
const MAX_VISIBLE_FACTS = 7;
const LANES = 5;

const LandingPage = ({ 
  onSignIn, 
  onSignUp, 
  error: parentError, 
  setIsSettingUsername,
  showUsernamePrompt,
  pendingCredentials
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignIn, setIsSignIn] = useState(true);
  const [triviaElements, setTriviaElements] = useState([]);
  const [recentFacts, setRecentFacts] = useState([]);
  const [localError, setLocalError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(null);
  const [isVisible, setIsVisible] = useState(true);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const timeoutRef = useRef(null);
  const containerRef = useRef(null);
  const lastLaneRef = useRef(-1);
  const checkUsername = httpsCallable(functions, 'checkUsername');
  const [localShowUsernamePrompt, setLocalShowUsernamePrompt] = useState(false); 
  const [googleUser, setGoogleUser] = useState(null);

  // Use either internal or external state for username prompt
  const effectiveShowUsernamePrompt = showUsernamePrompt || localShowUsernamePrompt;

  useEffect(() => {
    const getUniqueFact = (currentRecent) => {
      const availableFacts = triviaFacts.filter(f => !currentRecent.includes(f));
      if (availableFacts.length === 0) {
        return triviaFacts[Math.floor(Math.random() * triviaFacts.length)];
      }
      return availableFacts[Math.floor(Math.random() * availableFacts.length)];
    };

    const getNextLane = () => {
      const pattern = [0, 4, 2, 3, 1];
      lastLaneRef.current = (lastLaneRef.current + 1) % pattern.length;
      return pattern[lastLaneRef.current];
    };

    const addTrivia = () => {
      if (!isVisible) return;
      
      setTriviaElements(prev => {
        if (prev.length >= MAX_VISIBLE_FACTS) return prev;

        const fact = getUniqueFact(recentFacts);
        const lane = getNextLane();
        let leftPosition = (lane * (100 / LANES)) + 5;
        if (lane === 4) {
          const textWidth = fact.length * 0.6;
          const rightEdge = leftPosition + textWidth;
          if (rightEdge > 95) {
            leftPosition = Math.max(5, 95 - textWidth);
          }
        }

        const newTrivia = {
          id: Date.now(),
          text: fact,
          left: leftPosition,
          duration: 20,
          key: Date.now()
        };

        setRecentFacts(prevRecent => [...prevRecent, fact].slice(-MAX_RECENT_FACTS));
        return [...prev, newTrivia];
      });
    };

    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);
      if (!visible) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      } else if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          addTrivia();
          timeoutRef.current = setInterval(addTrivia, 5000);
        }, 500);
      }
    };

    timeoutRef.current = setTimeout(() => {
      addTrivia();
      timeoutRef.current = setInterval(addTrivia, 5000);
    }, 500);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(timeoutRef.current);
      clearInterval(timeoutRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  useEffect(() => {
    let isMounted = true;

    const checkUsernameAvailability = async () => {
      if (username.length < 3) {
        if (isMounted) {
          setUsernameError('Username must be at least 3 characters');
          setIsUsernameAvailable(null);
        }
        return;
      }

      try {
        console.log("Checking username availability:", username);
        const result = await checkUsername({ username });
        if (isMounted) {
          setIsUsernameAvailable(result.data.available);
          setUsernameError(result.data.available ? 'Username available!' : 'Username already taken');
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error checking username:", err);
          setUsernameError('Error checking username');
          setIsUsernameAvailable(null);
        }
      }
    };

    const debounce = setTimeout(() => {
      if (username && effectiveShowUsernamePrompt) checkUsernameAvailability();
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(debounce);
    };
  }, [username, effectiveShowUsernamePrompt, checkUsername]);

  const handleAnimationEnd = (id) => {
    setTriviaElements((prev) => prev.filter((t) => t.id !== id));
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    console.log("Form submitted");
    setLocalError('');
    
    if (!email || !password) {
      console.log("Email or password missing");
      setLocalError('Email and password are required');
      return;
    }

    console.log("Email type:", typeof email, "Value:", email);
    console.log("Password type:", typeof password, "Value:", "****");

    const emailStr = typeof email === 'string' ? email.trim() : String(email).trim();
    const passwordStr = typeof password === 'string' ? password.trim() : String(password).trim();
    
    console.log("Processed email type:", typeof emailStr, "Value:", emailStr);
    console.log("Processed password type:", typeof passwordStr, "Value:", "****");
    console.log("Remember me:", rememberMe);

    if (emailStr.length === 0 || passwordStr.length === 0) {
      console.log("Empty email or password after trimming");
      setLocalError('Email and password cannot be empty');
      return;
    }

    if (isSignIn) {
      console.log("Calling onSignIn with email and password");
      try {
        // Set the persistence type based on the rememberMe checkbox
        const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistenceType);
        
        // Now sign in
        await onSignIn(emailStr, passwordStr);
        console.log("onSignIn call complete");
        setEmail('');
        setPassword('');
      } catch (error) {
        console.error("Error from onSignIn:", error);
        setLocalError(error.message || "Error signing in");
      }
    } else {
      console.log("Calling onSignUp with email and password");
      try {
        await onSignUp(emailStr, passwordStr);
        console.log("onSignUp call complete");
        setEmail('');
        setPassword('');
      } catch (error) {
        console.error("Error from onSignUp:", error);
        
        // Provide a user-friendly message for email-already-in-use error
        if (error.code === 'auth/email-already-in-use') {
          setLocalError('This email address is already in use. Please use a different email or try signing in.');
        } else {
        setLocalError(error.message || "Error signing up");
        }
      }
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      // Set the persistence type based on the rememberMe checkbox
      const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistenceType);
      
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log('Google sign-up success, user:', result.user.uid);
      setGoogleUser(result.user);
      setLocalShowUsernamePrompt(true);
      setIsSettingUsername(true); // Prevent redirect
      console.log('showUsernamePrompt set to true, googleUser:', result.user.uid);
    } catch (err) {
      console.error('Google sign-up error:', err);
      // Only set error if it's not the popup-closed-by-user error
      if (err.code !== 'auth/popup-closed-by-user') {
      setLocalError(err.message || 'An error occurred during Google sign-up');
      }
      setIsSettingUsername(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      // Set the persistence type based on the rememberMe checkbox
      const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistenceType);
      
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await onSignIn(result.user); // Pass user object
      setEmail('');
      setPassword('');
      setUsername('');
    } catch (err) {
      console.error('Google sign-in error:', err);
      // Only set error if it's not the popup-closed-by-user error
      if (err.code !== 'auth/popup-closed-by-user') {
      setLocalError(err.message || 'An error occurred during Google sign-in');
      }
    }
  };

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    console.log("Username form submitted");
    setLocalError('');
    
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setUsernameError('Username is required');
      return;
    }
    if (trimmedUsername.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }
    
    // Only proceed if the username is available
    if (!isUsernameAvailable) {
      setUsernameError('Please choose an available username');
      return;
    }
    
    console.log("Username validated, proceeding with signup");

    try {
      // For Google Sign up
      if (googleUser) {
        console.log("Submitting username for Google user:", googleUser.uid);
        try {
          await onSignUp(googleUser, null, trimmedUsername);
          console.log("Google user signup complete");
          setLocalShowUsernamePrompt(false);
          setGoogleUser(null);
        } catch (err) {
          console.error("Error during Google user signup:", err);
          setLocalError(err.message || "Failed to complete signup");
          return;
        }
      } 
      // For Email Sign up (after verification)
      else if (pendingCredentials) {
        console.log("Submitting username for verified email user:", pendingCredentials.email);
        try {
          // For already verified users who logged in without a username set
          if (pendingCredentials.uid && !pendingCredentials.password) {
            console.log("User already logged in, just setting username");
            // Current user is already signed in
            await onSignUp(pendingCredentials.email, null, trimmedUsername);
          } else {
            console.log("Setting username after email verification");
            // Normal flow after email verification
            await onSignUp(pendingCredentials.email, pendingCredentials.password, trimmedUsername);
          }
          console.log("Email user signup/username update complete");
        } catch (err) {
          console.error("Error during email user signup:", err);
          setLocalError(err.message || "Failed to complete signup");
          return;
        }
      } else {
        console.error("No user context found for username submission");
        setLocalError("Could not determine user for username submission");
        return;
      }
      
      // Clear form state
      setUsername('');
      console.log("Clearing form state and redirecting");
      
      // Clear UI state to allow redirect
      setIsSettingUsername(false);
    } catch (err) {
      console.error('Username submission error:', err);
      setLocalError(err.message || 'Failed to set username');
      setIsSettingUsername(false);
    }
  };

  const toggleAuthMode = () => {
    setIsSignIn(!isSignIn);
    setLocalError('');
    setUsernameError('');
    setIsUsernameAvailable(null);
    setEmail('');
    setPassword('');
    setUsername('');
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    setShowPasswordReset(true);
    // If email is already entered in the sign-in form, use it as initial value
    if (email) {
      setResetEmail(email);
    }
  };

  const handleSendPasswordReset = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSent(false);
    
    if (!resetEmail || resetEmail.trim() === '') {
      setResetError('Please enter your email address');
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetSent(true);
      // Clear the error if any
      setResetError('');
      
      // Auto-close the password reset dialog after 5 seconds
      setTimeout(() => {
        setShowPasswordReset(false);
        setResetSent(false);
      }, 5000);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      setResetError(error.message || 'Failed to send password reset email');
    }
  };

  const closePasswordReset = () => {
    setShowPasswordReset(false);
    setResetEmail('');
    setResetError('');
    setResetSent(false);
  };

  if (effectiveShowUsernamePrompt) {
    return (
      <div className="landing-container">
        <h1>TriviaTrainer</h1>
        <p className="tagline">Set Your Username</p>
        <form className="auth-form" onSubmit={handleUsernameSubmit}>
          <div className="username-input-container" style={{ position: 'relative', width: '100%' }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            maxLength={20}
              style={{ 
                width: '100%',
                borderColor: isUsernameAvailable === true ? '#4cd964' : 
                           isUsernameAvailable === false ? '#ff4444' : 
                           '#6e48aa'
              }}
            />
            {username.length >= 3 && (
              <span 
                style={{ 
                  position: 'absolute', 
                  right: '10px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: isUsernameAvailable ? '#4cd964' : '#ff4444',
                  fontSize: '1.2rem'
                }}
              >
                {isUsernameAvailable === true ? '✓' : 
                 isUsernameAvailable === false ? '✗' : ''}
              </span>
            )}
          </div>
          {usernameError && (
            <p className={isUsernameAvailable ? 'success' : 'error'}>
              {usernameError}
            </p>
          )}
          <button 
            type="submit" 
            className="cta-button"
            disabled={!isUsernameAvailable && username.length >= 3}
          >
            Submit
          </button>
          {localError && <p className="error">{localError}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="landing-container" ref={containerRef}>
      <h1>TriviaTrainer</h1>
      <p className="tagline">Sharpen your mind. Master your knowledge.</p>
      <form className="auth-form" onSubmit={handleEmailAuth}>
        <div className="form-field">
          <label htmlFor="email">Email</label>
        <input
            id="email"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
        <input
            id="password"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        </div>
        
        <div className="remember-me">
            <input
            type="checkbox" 
            id="remember" 
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <label htmlFor="remember">Remember me?</label>
        </div>
        
        <button type="submit" className="cta-button login-button">
          {isSignIn ? 'LOGIN' : 'SIGN UP'}
        </button>
        
        {isSignIn && (
          <div className="forgot-password">
            <button 
              onClick={handleForgotPassword} 
              className="link-button"
              type="button"
            >
              Forgot Password?
            </button>
          </div>
        )}
        
        <div className="divider">
          <span>OR</span>
        </div>
        
        <button 
          type="button" 
          className="google-button"
          onClick={isSignIn ? handleGoogleSignIn : handleGoogleSignUp}
        >
          <span className="google-icon">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          </span>
          {isSignIn ? 'Sign In with Google' : 'Sign Up with Google'}
          </button>
        
        <div className="account-toggle">
          {isSignIn ? "Need an account?" : "Already have an account?"}{' '}
          <button 
            onClick={toggleAuthMode} 
            className="link-button"
            type="button"
          >
            {isSignIn ? 'SIGN UP' : 'SIGN IN'}
          </button>
        </div>
        
        {(localError || parentError) && (
          <p className="error">{localError || parentError}</p>
        )}
      </form>

      {/* Password Reset Modal */}
      {showPasswordReset && (
        <div className="modal-overlay" onClick={closePasswordReset}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Reset Password</h2>
            {resetSent ? (
              <div className="reset-success">
                <p>Password reset email sent! Please check your inbox.</p>
                <button onClick={closePasswordReset} className="cta-button">Close</button>
              </div>
            ) : (
              <form onSubmit={handleSendPasswordReset}>
                <p>Enter your email address and we'll send you a link to reset your password.</p>
                <div className="form-field">
                  <label htmlFor="reset-email">Email</label>
                  <input
                    id="reset-email"
                    type="email"
                    placeholder="Email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                {resetError && <p className="error">{resetError}</p>}
                <div className="modal-buttons">
                  <button type="button" onClick={closePasswordReset} className="cancel-button">
                    Cancel
                  </button>
                  <button type="submit" className="cta-button">
                    Send Reset Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      
      {triviaElements.map((trivia) => (
        <div
          key={trivia.key}
          id={`trivia-${trivia.id}`}
          className={isVisible ? 'background-trivia' : 'background-trivia paused'}
          style={{
            left: `${trivia.left}%`,
            top: '-100px',
            animation: `fall ${trivia.duration}s linear`
          }}
          onAnimationEnd={() => handleAnimationEnd(trivia.id)}
        >
          {trivia.text}
        </div>
      ))}
    </div>
  );
};

export default LandingPage;