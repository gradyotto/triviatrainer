import React, { useState, useEffect, useRef } from 'react';
import { auth, functions } from './firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
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

    if (emailStr.length === 0 || passwordStr.length === 0) {
      console.log("Empty email or password after trimming");
      setLocalError('Email and password cannot be empty');
      return;
    }

    if (isSignIn) {
      console.log("Calling onSignIn with email and password");
      try {
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
        setLocalError(error.message || "Error signing up");
      }
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log('Google sign-up success, user:', result.user.uid);
      setGoogleUser(result.user);
      setLocalShowUsernamePrompt(true);
      setIsSettingUsername(true); // Prevent redirect
      console.log('showUsernamePrompt set to true, googleUser:', result.user.uid);
    } catch (err) {
      console.error('Google sign-up error:', err);
      setLocalError(err.message || 'An error occurred during Google sign-up');
      setIsSettingUsername(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await onSignIn(result.user); // Pass user object
      setEmail('');
      setPassword('');
      setUsername('');
    } catch (err) {
      console.error('Google sign-in error:', err);
      setLocalError(err.message || 'An error occurred during Google sign-in');
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
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="auth-buttons">
          <button type="submit" className="cta-button">
            {isSignIn ? 'Sign In' : 'Sign Up'}
          </button>
          {isSignIn ? (
            <button type="button" className="cta-button" onClick={handleGoogleSignIn}>
              Sign In with Google
            </button>
          ) : (
            <button type="button" className="cta-button" onClick={handleGoogleSignUp}>
              Sign Up with Google
            </button>
          )}
        </div>
        {(localError || parentError) && (
          <p className="error">{localError || parentError}</p>
        )}
      </form>
      <p>
        {isSignIn ? "Don't have an account?" : "Already have an account?"}{' '}
        <span onClick={toggleAuthMode} className="link" style={{ cursor: 'pointer', color: '#9d50bb' }}>
          {isSignIn ? 'Sign up' : 'Sign in'}
        </span>
      </p>
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