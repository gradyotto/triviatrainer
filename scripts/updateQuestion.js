const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");

// Load the service account key
const serviceAccount = require("./serviceAccountKey.json");

const app = initializeApp({
  credential: require("firebase-admin").credential.cert(serviceAccount),
  projectId: "triviatrainer-357f9"
});
const db = getFirestore(app);

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log("Usage: node updateQuestion.js <questionId> <field> <value>");
  console.log("Example: node updateQuestion.js 273 hint 'This is a new hint'");
  console.log("For fields with spaces, enclose in quotes");
  process.exit(1);
}

const questionId = args[0];
const field = args[1];
const value = args[2];

async function updateQuestion() {
  try {
    console.log(`Updating question ${questionId}, setting ${field} to: ${value}`);
    
    // Get the current question data
    const questionRef = db.collection("questions").doc(questionId);
    const questionDoc = await questionRef.get();
    
    if (!questionDoc.exists) {
      console.error(`Question with ID ${questionId} not found!`);
      process.exit(1);
    }
    
    // Update the field
    const update = {};
    update[field] = value;
    
    await questionRef.update(update);
    console.log(`Question ${questionId} updated successfully!`);
  } catch (error) {
    console.error("Error updating question:", error);
    process.exit(1);
  }
}

updateQuestion().then(() => {
  console.log("Script execution completed.");
  process.exit(0);
}).catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
}); 