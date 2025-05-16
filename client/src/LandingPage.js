import React, { useState, useEffect, useRef } from 'react';
import { auth, functions } from './firebase';
import { signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, browserLocalPersistence, browserSessionPersistence, setPersistence } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { Brain, Mail, Lock, LogIn, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

// Logo Component
const Logo = () => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true);
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`transition-all duration-1000 ${loaded ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}>
      <div className="logo-container">
        <div className="logo-background" />
        <div className="logo-icon-wrapper">
          <Brain className="logo-icon" />
        </div>
      </div>
    </div>
  );
};

// Neural Network Background Component
const NeuralBackground = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const isVisibleRef = useRef(true);
  const nodesRef = useRef([]);
  const isInitializedRef = useRef(false);
  const lastDimensionsRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Node class for neurons
    class Node {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.connections = [];
        this.size = Math.random() * 3 + 1;
        this.speed = {
          x: (Math.random() - 0.5) * 0.2, // Slightly slower movement
          y: (Math.random() - 0.5) * 0.2
        };
        // Save relative positions for smooth resizing
        this.relativeX = x / canvas.width;
        this.relativeY = y / canvas.height;
        this.originalX = x;
        this.originalY = y;
      }

      update(width, height) {
        // Handle resize - update position proportionally
        if (width !== lastDimensionsRef.current.width || 
            height !== lastDimensionsRef.current.height) {
          
          // When expanding, respect relative position to maintain distribution
          this.x = this.relativeX * width;
          this.y = this.relativeY * height;
        }
        
        // Update relative position
        this.relativeX = this.x / width;
        this.relativeY = this.y / height;
        
        // Normal movement update
        this.x += this.speed.x;
        this.y += this.speed.y;

        // Bounce off edges
        if (this.x <= 0 || this.x >= width) {
          this.speed.x *= -1;
          this.x = Math.max(0, Math.min(this.x, width));
        }
        if (this.y <= 0 || this.y >= height) {
          this.speed.y *= -1;
          this.y = Math.max(0, Math.min(this.y, height));
        }
      }

      draw() {
        // Draw connections
        this.connections.forEach(node => {
          ctx.beginPath();
          ctx.moveTo(this.x, this.y);
          ctx.lineTo(node.x, node.y);
          
          // Calculate distance for line opacity
          const dx = this.x - node.x;
          const dy = this.y - node.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = 300;
          const opacity = Math.max(0.05, Math.min(0.2, 1 - (distance / maxDistance)));
          
          ctx.strokeStyle = `rgba(155, 135, 245, ${opacity})`;
          ctx.stroke();
        });

        // Draw node
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = '#9b87f5';
        ctx.fill();
      }
    }

    // Initialize nodes
    const initNodes = () => {
      // Only create new nodes if not already initialized
      if (!isInitializedRef.current) {
        // Create nodes based on screen size
        const nodeCount = Math.floor((canvas.width * canvas.height) / 20000);
        
        for (let i = 0; i < nodeCount; i++) {
          nodesRef.current.push(new Node(
            Math.random() * canvas.width,
            Math.random() * canvas.height
          ));
        }

        // Connect nodes with permanent connections
        nodesRef.current.forEach(node => {
          // Connect each node to several others based on probability
          nodesRef.current.forEach(otherNode => {
            if (node !== otherNode && Math.random() > 0.92) {
              node.connections.push(otherNode);
            }
          });
          
          // Ensure each node has at least one connection
          if (node.connections.length === 0 && nodesRef.current.length > 1) {
            // Find closest node
            let closestNode = null;
            let minDistance = Infinity;
            
            nodesRef.current.forEach(otherNode => {
              if (node !== otherNode) {
                const dx = node.x - otherNode.x;
                const dy = node.y - otherNode.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < minDistance) {
                  minDistance = distance;
                  closestNode = otherNode;
                }
              }
            });
            
            if (closestNode) {
              node.connections.push(closestNode);
            }
          }
        });
        
        isInitializedRef.current = true;
        lastDimensionsRef.current = { width: canvas.width, height: canvas.height };
      }
    };
    
    // Resize handler to maintain full screen canvas
    const handleResize = () => {
      const oldWidth = canvas.width;
      const oldHeight = canvas.height;
      
      // Update canvas dimensions
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Initialize nodes if needed
      if (!isInitializedRef.current) {
        initNodes();
      } else {
        // Handle significant growth - add nodes in the new space
        if (canvas.width > oldWidth + 200 || canvas.height > oldHeight + 200) {
          // Calculate the extra area
          const extraWidth = Math.max(0, canvas.width - oldWidth);
          const extraHeight = Math.max(0, canvas.height - oldHeight);
          const extraArea = (extraWidth * canvas.height) + (extraHeight * oldWidth);
          
          // Only add nodes if there's significant new area
          if (extraArea > 40000) {
            const nodesToAdd = Math.floor(extraArea / 20000);
            
            for (let i = 0; i < nodesToAdd; i++) {
              // Position new nodes in the expanded areas
              let x, y;
              
              if (extraWidth > 0 && extraHeight > 0) {
                // Both dimensions expanded
                if (Math.random() < 0.5) {
                  // Place in new width area
                  x = oldWidth + Math.random() * extraWidth;
                  y = Math.random() * canvas.height;
                } else {
                  // Place in new height area
                  x = Math.random() * canvas.width;
                  y = oldHeight + Math.random() * extraHeight;
                }
              } else if (extraWidth > 0) {
                // Only width expanded - place in new area
                x = oldWidth + Math.random() * extraWidth;
                y = Math.random() * canvas.height;
              } else {
                // Only height expanded - place in new area
                x = Math.random() * canvas.width;
                y = oldHeight + Math.random() * extraHeight;
              }
              
              const newNode = new Node(x, y);
              
              // Connect to existing nodes
              nodesRef.current.forEach(existingNode => {
                if (Math.random() > 0.92) {
                  existingNode.connections.push(newNode);
                }
                if (Math.random() > 0.92) {
                  newNode.connections.push(existingNode);
                }
              });
              
              nodesRef.current.push(newNode);
            }
          }
        }
        
        // Handle significant shrinking - remove nodes if needed
        else if ((oldWidth > canvas.width + 200 || oldHeight > canvas.height + 200) && 
                 nodesRef.current.length > 10) {
          const currentArea = canvas.width * canvas.height;
          const idealNodeCount = Math.floor(currentArea / 20000);
          
          // Only remove if we have more than ideal
          if (nodesRef.current.length > idealNodeCount) {
            const nodesToRemove = nodesRef.current.length - idealNodeCount;
            
            // Sort by position - remove nodes that are outside or near the edge first
            nodesRef.current.sort((a, b) => {
              // Calculate how "outside" or near the edge the node is
              const aOutside = Math.max(0, a.x - canvas.width) + Math.max(0, -a.x) + 
                              Math.max(0, a.y - canvas.height) + Math.max(0, -a.y);
              const bOutside = Math.max(0, b.x - canvas.width) + Math.max(0, -b.x) + 
                              Math.max(0, b.y - canvas.height) + Math.max(0, -b.y);
              return bOutside - aOutside; // Higher values (more outside) first
            });
            
            // Remove from the end after sorting
            for (let i = 0; i < nodesToRemove; i++) {
              const removedNode = nodesRef.current.shift(); // Remove from beginning (most outside)
              // Remove all connections to this node
              nodesRef.current.forEach(node => {
                node.connections = node.connections.filter(conn => conn !== removedNode);
              });
            }
          }
        }
        
        // Update the dimensions reference
        lastDimensionsRef.current = { width: canvas.width, height: canvas.height };
      }
    };
    
    // Animation loop
    const animate = () => {
      if (!isVisibleRef.current) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw nodes
      nodesRef.current.forEach(node => {
        node.update(canvas.width, canvas.height);
        node.draw();
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    // Handle visibility changes
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
    };
    
    // Set up event listeners and start animation
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Initial setup
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initNodes();
    animationRef.current = requestAnimationFrame(animate);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animationRef.current);
      nodesRef.current = [];
      isInitializedRef.current = false;
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="neural-background"
    />
  );
};

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
  "The Hawaiian alphabet has only 12 letters",
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
  const [showPassword, setShowPassword] = useState(false);
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
        <NeuralBackground />
        <div className="content-wrapper">
          <Logo />
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
      </div>
    );
  }

  return (
    <div className="landing-container" ref={containerRef}>
      <NeuralBackground />
      <div className="content-wrapper">
        <Logo />
      <h1>TriviaTrainer</h1>
        <p className="tagline">Train your brain with fun!</p>
      
      <form className="auth-form" onSubmit={handleEmailAuth}>
          <div className="form-group">
          <label htmlFor="email">Email</label>
            <div className="input-with-icon">
              <Mail className="input-icon" size={18} />
        <input
            id="email"
          type="email"
                placeholder="your.email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        </div>
          </div>
          
          <div className="form-group">
          <label htmlFor="password">Password</label>
            <div className="input-with-icon">
              <Lock className="input-icon" size={18} />
        <input
            id="password"
                type={showPassword ? "text" : "password"}
                placeholder="********"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
        </div>
        
          <div className="form-footer">
        <div className="remember-me">
            <input
            type="checkbox" 
            id="remember" 
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <label htmlFor="remember">Remember me?</label>
        </div>
        
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
          </div>
          
          <button type="submit" className="cta-button login-button">
            <LogIn size={18} />
            <span>{isSignIn ? 'LOGIN' : 'SIGN UP'}</span>
          </button>
        
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
            Sign in with Google
        </button>
        
        <div className="account-toggle">
            Need an account? <button 
            onClick={toggleAuthMode} 
              className="link-button signup-link"
            type="button"
              style={{
                color: '#9482ee',
                fontWeight: 600,
                textDecoration: 'none',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: 0,
                marginLeft: '4px'
              }}
            >
              SIGN UP
          </button>
        </div>
        
        {(localError || parentError) && (
          <p className="error">{localError || parentError}</p>
        )}
      </form>
      </div>

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
                <div className="form-group">
                  <label htmlFor="reset-email">Email</label>
                  <div className="input-with-icon">
                    <Mail className="input-icon" size={18} />
                    <input
                      id="reset-email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                  </div>
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
    </div>
  );
};

export default LandingPage;