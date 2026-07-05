
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ,
  authDomain: "jarvisai-39b3a.firebaseapp.com",
  projectId: "jarvisai-39b3a",
  storageBucket: "jarvisai-39b3a.firebasestorage.app",
  messagingSenderId: "96863935239",
  appId: "1:96863935239:web:d4db05b36ea12cb2a083a2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app)
const provider = new GoogleAuthProvider()

export {auth, provider}