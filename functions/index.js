const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

exports.getQuestions = onCall(
  { timeoutSeconds: 60, memory: "256MiB" },
  async (request) => {
    console.log("getQuestions called with data:", request.data);

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    const db = getFirestore();
    const uid = request.auth.uid;
    const categories = Array.isArray(request.data.categories) ? request.data.categories : [];
    const maxQuestions = request.data.maxQuestions || 50;

    console.log("Requested categories:", categories);
    console.log("Requested max questions:", maxQuestions);

    const rateLimitRef = db.collection("rateLimits").doc(uid);
    const requestLimit = 50;
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    await db.runTransaction(async (transaction) => {
      const rateLimitDoc = await transaction.get(rateLimitRef);
      let requestCount = 0;
      let lastResetTime = now;

      if (rateLimitDoc.exists) {
        const data = rateLimitDoc.data();
        console.log("Current rate limit data:", data);

        if (data.lastResetTime < oneMinuteAgo) {
          console.log("Resetting rate limit counter (expired)");
          requestCount = 1;
          lastResetTime = now;
        } else {
          requestCount = (data.requestCount || 0) + 1;
          lastResetTime = data.lastResetTime;
          if (requestCount > requestLimit) {
            console.log("Rate limit exceeded:", requestCount);
            throw new HttpsError("resource-exhausted", "Rate limit exceeded. Please try again later.");
          }
        }
      } else {
        console.log("Creating new rate limit record");
        requestCount = 1;
      }

      transaction.set(rateLimitRef, { requestCount, lastResetTime });
    });

    console.log("Rate limit check passed");

    const questionsRef = db.collection("questions");
    let questions = [];

    if (categories.length > 0) {
      console.log("Filtering by categories:", categories);
      if (categories.length > 10) {
        throw new HttpsError("invalid-argument", "Max 10 categories allowed.");
      }
      const snapshot = await questionsRef.where("category", "in", categories).limit(maxQuestions).get();
      snapshot.forEach((doc) => {
        questions.push({ id: doc.id, ...doc.data() });
      });
    } else {
      const snapshot = await questionsRef.limit(maxQuestions).get();
      snapshot.forEach((doc) => {
        questions.push({ id: doc.id, ...doc.data() });
      });
    }

    console.log(`Found ${questions.length} questions`);
    const shuffledQuestions = questions.sort(() => Math.random() - 0.5);
    const formattedQuestions = shuffledQuestions.map((question) => {
      if (!question.options) return question;
      if (!Array.isArray(question.options)) {
        question.options = typeof question.options === "string"
          ? question.options.split(",").map((opt) => opt.trim())
          : Object.values(question.options);
      }
      return question;
    });

    console.log(`Returning ${formattedQuestions.length} questions`);
    return { status: "success", data: formattedQuestions };
  }
);