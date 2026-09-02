import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from "firebase/firestore";

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

// מפעילים קאש מקומי (IndexedDB) ל-Firestore — כך שקריאה/כתיבה של המידע עובדות
// גם בלי אינטרנט, ומסתנכרנות אוטומטית לענן ברגע שהחיבור חוזר.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
});
