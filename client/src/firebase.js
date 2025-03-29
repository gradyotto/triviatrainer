// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from 'firebase/firestore'; 
import { 
  initializeAppCheck, 
  ReCaptchaV3Provider, 
  setTokenAutoRefreshEnabled, 
  onTokenChanged 
} from 'firebase/app-check';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyABONDya-TVSJoIvGWiZU-RDXJC85GvlZg",
  authDomain: "triviatrainer-357f9.firebaseapp.com",
  projectId: "triviatrainer-357f9",
  storageBucket: "triviatrainer-357f9.appspot.com", // Fixed typo
  messagingSenderId: "400447255575",
  appId: "1:400447255575:web:ec2603b8c86892ee53d852",
  measurementId: "G-284N6P0PZY"
};

// Determine environment
const isDevelopment = 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  window.location.hostname.includes('192.168.');

// Initialize Firebase first
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Configure App Check based on environment
let appCheck;

try {
  if (isDevelopment) {
    // For local development only
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = '8AB75038-61B9-4E29-922E-705756186EB1';
    console.log('Debug mode enabled for local development');
  }

  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LeSUQIrAAAAAP_O4zJkArAlbZSNW4oi8UoFaDil'),
    isTokenAutoRefreshEnabled: true
  });

  // For better debugging
  onTokenChanged(appCheck, (token) => {
    console.log('App Check token received successfully');
  });

  console.log('App Check initialized successfully');
} catch (error) {
  console.error('Error initializing App Check:', error);
  // Continue app operation even if App Check fails
}

export { auth, db, app };