const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, getDoc, setDoc } = require('firebase/firestore');
const fs = require('fs');

const firebaseConfig = {
    apiKey: "AIzaSyABONDya-TVSJoIvGWiZU-RDXJC85GvlZg",
    authDomain: "triviatrainer-357f9.firebaseapp.com",
    projectId: "triviatrainer-357f9",
    storageBucket: "triviatrainer-357f9.firebasestorage.app",
    messagingSenderId: "400447255575",
    appId: "1:400447255575:web:ec2603b8c86892ee53d852",
    measurementId: "G-284N6P0PZY"
  };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));

async function uploadQuestions() {
  for (const question of questions) {
    try {
      // Reference the document with the question's id
      const docRef = doc(db, 'questions', question.id.toString());
      
      // Check if the document already exists
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        console.log(`Question with ID ${question.id} already exists, skipping...`);
      } else {
        // If it doesn’t exist, add it
        await setDoc(docRef, question);
        console.log(`Added question with ID: ${question.id}`);
      }
    } catch (e) {
      console.error(`Error processing question with ID ${question.id}:`, e);
    }
  }
  console.log('Upload process completed.');
}

uploadQuestions();