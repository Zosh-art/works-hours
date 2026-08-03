import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCVRVvrEyBHSGUQT8Ls8dwHLazh3ttjbWY",
  authDomain: "works-tracker.firebaseapp.com",
  projectId: "works-tracker",
  storageBucket: "works-tracker.firebasestorage.app",
  messagingSenderId: "974169925415",
  appId: "1:974169925415:web:bf2f6592403b59535bab02",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);