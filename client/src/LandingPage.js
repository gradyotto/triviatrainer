import React, { useState, useEffect, useRef } from 'react';
import { auth } from './firebase'; // Adjust path as needed
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
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
  "Cleopatra lived closer in time to the moon landing than to the building of the Great Pyramid",
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

const LandingPage = ({ onSignUp }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [triviaElements, setTriviaElements] = useState([]);
  const [recentFacts, setRecentFacts] = useState([]);
  const [localError, setLocalError] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const timeoutRef = useRef(null);
  const containerRef = useRef(null);
  const lastLaneRef = useRef(-1); // Track the last used lane

  useEffect(() => {
    const shuffleArray = (array) => [...array].sort(() => Math.random() - 0.5);

    const getUniqueFact = (currentRecent) => {
      const availableFacts = triviaFacts.filter(f => !currentRecent.includes(f));
      if (availableFacts.length === 0) {
        return triviaFacts[Math.floor(Math.random() * triviaFacts.length)];
      }
      return availableFacts[Math.floor(Math.random() * availableFacts.length)];
    };

    // Get next lane in alternating pattern
    const getNextLane = () => {
      // Pattern: 0 -> 4 -> 2 -> 3 -> 1 -> repeat
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
        
        // Calculate base position
        let leftPosition = (lane * (100 / LANES)) + 5;
        
        // If it's the rightmost lane (lane 4), adjust position to prevent cutoff
        if (lane === 4) {
          // Calculate approximate width of text (rough estimate based on character count)
          const textWidth = fact.length * 0.6; // Assuming each character is roughly 0.6% of viewport width
          const rightEdge = leftPosition + textWidth;
          
          // If the text would extend beyond viewport, adjust leftPosition
          if (rightEdge > 95) { // Leave 5% margin from right edge
            leftPosition = Math.max(5, 95 - textWidth); // Ensure it doesn't go too far left
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
          timeoutRef.current = setInterval(addTrivia, 3000); // Increased interval for better spacing
        }, 500);
      }
    };

    // Start with initial facts
    timeoutRef.current = setTimeout(() => {
      addTrivia(); // Add first fact
      timeoutRef.current = setInterval(addTrivia, 3000); // Start regular interval
    }, 500);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(timeoutRef.current);
      clearInterval(timeoutRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isVisible]);

  const handleAnimationEnd = (id) => {
    setTriviaElements((prev) => prev.filter((t) => t.id !== id));
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      onSignUp(userCredential.user);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleGoogleSignUp = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      onSignUp(result.user);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleSignInLink = () => {
    console.log('Navigate to sign-in page'); // Replace with your navigation logic
  };

  return (
    <div className="landing-container" ref={containerRef}>
      <h1>TriviaTrainer</h1>
      <p className="tagline">Sharpen your mind. Master your knowledge.</p>
      <form className="auth-form" onSubmit={handleEmailSignUp}>
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
          <button type="submit" className="cta-button">Sign Up</button>
          <button type="button" className="cta-button" onClick={handleGoogleSignUp}>
            Sign Up with Google
          </button>
        </div>
        {localError && <p className="error">{localError}</p>}
      </form>
      <p>
        Already have an account?{' '}
        <span onClick={handleSignInLink} className="link" style={{ cursor: 'pointer', color: '#007bff' }}>
          Sign in
        </span>
      </p>
      <button className="cta-button start-button" disabled>Start Training</button>
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