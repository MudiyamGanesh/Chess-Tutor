import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBV9-xiOE0U-DLJfoiOcaLxp6iJdU3Y5FM",
  authDomain: "grandmaster-its.firebaseapp.com",
  projectId: "grandmaster-its",
  storageBucket: "grandmaster-its.firebasestorage.app",
  messagingSenderId: "622457930412",
  appId: "1:622457930412:web:974e78f40a4fac8a4e9509"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);