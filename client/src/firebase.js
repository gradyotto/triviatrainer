// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyABONDya-TVSJoIvGWiZU-RDXJC85GvlZg",
  authDomain: "triviatrainer-357f9.firebaseapp.com",
  projectId: "triviatrainer-357f9",
  storageBucket: "triviatrainer-357f9.firebasestorage.app",
  messagingSenderId: "400447255575",
  appId: "1:400447255575:web:ec2603b8c86892ee53d852",
  measurementId: "G-284N6P0PZY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app); // Export auth for use in App.js