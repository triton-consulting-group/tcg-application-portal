const admin = require("firebase-admin");

let app = null;

// Only the project ID is needed to verify ID tokens; no service account required.
const getFirebaseAuth = () => {
  if (!app) {
    if (!process.env.FIREBASE_PROJECT_ID) {
      throw new Error("FIREBASE_PROJECT_ID is not set");
    }
    app = admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  }
  return admin.auth(app);
};

module.exports = { getFirebaseAuth };
