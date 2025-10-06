import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDlQkiPSwjY_MTSSliU9mLT62z2LSj74Zo",
  authDomain: "tcgfirebase-db9b2.firebaseapp.com",
  projectId: "tcgfirebase-db9b2",
  storageBucket: "tcgfirebase-db9b2.firebasestorage.app",
  messagingSenderId: "89677566801",
  appId: "1:89677566801:web:cb7b8933c0e3a228bc3970",
  measurementId: "G-VGQWNENVYM"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

export default app;
