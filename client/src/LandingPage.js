import React, { useState, useEffect } from 'react';
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
  "The shortest war in history lasted 38 minutes",
  "The shortest war in history lasted 38 minutes", // (removing this duplicate below)
  "A group of crows is called a murder",
  "The shortest war in history lasted 38 minutes", // Replacing duplicate with new fact
  "The Vatican, Disney World, and Russia all have their own official calendars",
  "A blue whale’s tongue weighs as much as an elephant",
  "The shortest war in history lasted 38 minutes", // Replacing duplicate with new fact
  "The inventor of the frisbee was turned into a frisbee after he died",
  "Wombat poop is cube-shaped",
  "The first oranges weren’t orange—they were green",
  "A group of pandas is called an embarrassment",
  "The unicorn is Scotland’s national animal",
  "There’s a species of spider called the Hobo Spider",
  "A snail can sleep for three years",
  "The smell of rain is caused by bacteria in the soil",
  "The longest place name in the world has 85 letters",
  "A group of porcupines is called a prickle",
  "The first computer mouse was made of wood",
  "A crocodile cannot stick its tongue out",
  "The world’s largest desert isn’t the Sahara—it’s Antarctica",
  "A group of rhinos is called a crash",
  "The first alarm clock could only ring at 4 a.m.",
  "A cat’s nose print is unique, like a human fingerprint",
  "The deepest part of the ocean is over 36,000 feet deep",
  "A group of jellyfish is called a smack",
  "The first email was sent in 1971",
  "A shrimp’s heart is in its head"
];

const MAX_RECENT_FACTS = 10; // Limit how many recent facts to track
const LANES = 5; // Number of horizontal lanes to spread facts across

const LandingPage = ({ onSignIn, onSignUp, error }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [triviaElements, setTriviaElements] = useState([]);
  const [recentFacts, setRecentFacts] = useState([]);

  useEffect(() => {
    // Initialize with spread-out facts
    const initialFacts = [];
    for (let i = 0; i < 10; i++) {
      const fact = getUniqueFact();
      const lane = i % LANES;
      initialFacts.push({
        id: Date.now() + i,
        text: fact,
        left: (lane * (100 / LANES)) + (Math.random() * (100 / LANES) * 0.5), // Spread within lane
        top: Math.random() * 80, // Start at random height up to 80vh
        duration: 15 + Math.random() * 10,
        key: Date.now() + i
      });
    }
    setTriviaElements(initialFacts);

    const addTrivia = () => {
      const fact = getUniqueFact();
      const lane = Math.floor(Math.random() * LANES);
      const newTrivia = {
        id: Date.now(),
        text: fact,
        left: (lane * (100 / LANES)) + (Math.random() * (100 / LANES) * 0.5),
        duration: 15 + Math.random() * 10,
        key: Date.now()
      };

      setTriviaElements(prev => {
        // Filter out facts that have fallen off screen
        const active = prev.filter(t => {
          const elapsed = (Date.now() - t.id) / 1000;
          return elapsed < t.duration;
        });
        return [...active, newTrivia];
      });

      setRecentFacts(prev => {
        const newRecent = [...prev, fact].slice(-MAX_RECENT_FACTS);
        return newRecent;
      });
    };

    const interval = setInterval(addTrivia, 2000); // Slower spawn rate
    return () => clearInterval(interval);
  }, []);

  const getUniqueFact = () => {
    const availableFacts = triviaFacts.filter(f => !recentFacts.includes(f));
    if (availableFacts.length === 0) {
      setRecentFacts([]); // Reset if we've used all facts
      return triviaFacts[Math.floor(Math.random() * triviaFacts.length)];
    }
    return availableFacts[Math.floor(Math.random() * availableFacts.length)];
  };

  const handleSignIn = (e) => {
    e.preventDefault();
    onSignIn(email, password);
  };

  const handleSignUp = (e) => {
    e.preventDefault();
    onSignUp(email, password);
  };

  return (
    <div className="landing-container">
      <h1>TriviaTrainer</h1>
      <p className="tagline">Sharpen your mind. Master your knowledge.</p>
      <form className="auth-form" onSubmit={handleSignIn}>
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
          <button type="submit" className="cta-button">Sign In</button>
          <button type="button" className="cta-button" onClick={handleSignUp}>Sign Up</button>
        </div>
        {error && <p className="error">{error}</p>}
      </form>
      <button className="cta-button start-button" disabled>Start Training</button>
      {triviaElements.map(trivia => (
        <div
          key={trivia.key}
          className="background-trivia"
          style={{
            left: `${trivia.left}%`,
            top: trivia.top ? `${trivia.top}vh` : '-100px',
            animationDuration: `${trivia.duration}s`,
            animationDelay: trivia.top ? `-${(trivia.top / 100) * trivia.duration}s` : '0s'
          }}
        >
          {trivia.text}
        </div>
      ))}
    </div>
  );
};

export default LandingPage;