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
if (args.length < 2) {
  console.log("Usage: node updateQuestionFull.js <questionId> <jsonString>");
  console.log("Example: node updateQuestionFull.js 273 '{\"hint\":\"New hint\",\"explanation\":\"New explanation\"}'");
  console.log("Or you can specify a JSON file path:");
  console.log("Example: node updateQuestionFull.js 273 ./question273.json");
  process.exit(1);
}

const questionId = args[0];
let updateData;

// Check if the second argument is a file path or a JSON string
if (args[1].endsWith('.json') && fs.existsSync(args[1])) {
  try {
    const fileContent = fs.readFileSync(args[1], 'utf8');
    updateData = JSON.parse(fileContent);
  } catch (error) {
    console.error("Error reading or parsing JSON file:", error);
    process.exit(1);
  }
} else {
  try {
    updateData = JSON.parse(args[1]);
  } catch (error) {
    console.error("Error parsing JSON string:", error);
    process.exit(1);
  }
}

async function updateQuestion() {
  try {
    console.log(`Updating question ${questionId} with data:`, updateData);
    
    // Get the current question data
    const questionRef = db.collection("questions").doc(questionId);
    const questionDoc = await questionRef.get();
    
    if (!questionDoc.exists) {
      console.error(`Question with ID ${questionId} not found!`);
      process.exit(1);
    }
    
    // Update the question with the provided data
    await questionRef.update(updateData);
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