import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBFDCCmjmXrZzNOKr9Getod23VXZ0mb2dw",
  authDomain: "tcg-application-portal-db9b2.firebaseapp.com",
  projectId: "tcg-application-portal-db9b2",
  storageBucket: "tcg-application-portal-db9b2.firebasestorage.app",
  messagingSenderId: "577760705930",
  appId: "1:577760705930:web:e407e8851ff60a34dc5c73",
  measurementId: "G-MX2H0GXFM3"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

export default app;
