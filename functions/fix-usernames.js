const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Load the service account key
const serviceAccount = require("./serviceAccountKey.json");

const app = initializeApp({
  credential: require("firebase-admin").credential.cert(serviceAccount),
  projectId: "triviatrainer-357f9" // Explicitly set your project ID
});
const db = getFirestore(app);

async function fixUsernames() {
  const snapshot = await db.collection("users").get();
  const batch = db.batch();
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.username && data.username !== data.username.toLowerCase()) {
      batch.update(doc.ref, { username: data.username.toLowerCase() });
    }
  });
  await batch.commit();
  console.log("Usernames updated to lowercase.");
}

fixUsernames().catch(console.error);