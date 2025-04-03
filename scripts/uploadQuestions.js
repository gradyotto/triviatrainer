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

const questions = JSON.parse(fs.readFileSync("questions.json", "utf8"));

async function uploadQuestions() {
  try {
    // First, get all existing question IDs
    console.log("Checking for existing questions...");
    const snapshot = await db.collection("questions").get();
    const existingIds = new Set();
    snapshot.forEach(doc => existingIds.add(doc.id));
    console.log(`Found ${existingIds.size} existing questions`);

    // Filter out questions that already exist
    const newQuestions = questions.filter(q => !existingIds.has(q.id.toString()));
    console.log(`${newQuestions.length} new questions to upload`);

    if (newQuestions.length === 0) {
      console.log("No new questions to upload. Exiting.");
      return;
    }

    // Upload new questions in batches
    const batchSize = 500;
    let batchCount = 0;
    let successCount = 0;
    
    for (let i = 0; i < newQuestions.length; i += batchSize) {
      const batch = db.batch();
      const currentBatch = newQuestions.slice(i, i + batchSize);
      
      for (const question of currentBatch) {
        const docRef = db.collection("questions").doc(question.id.toString());
        batch.set(docRef, question);
      }
      
      await batch.commit();
      batchCount++;
      successCount += currentBatch.length;
      console.log(`Committed batch ${batchCount}, uploaded ${currentBatch.length} questions (Total: ${successCount})`);
    }
    
    console.log(`Upload completed successfully. Total new questions uploaded: ${successCount}`);
  } catch (error) {
    console.error("Error during upload:", error);
    throw error; // Re-throw to trigger the catch block in the main promise chain
  }
}

uploadQuestions().then(() => {
  console.log("Script execution completed.");
}).catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});