import { ref, child, set, update, push } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAKGL7v8zhVHFsoV_AWwgAshiWmv8v84yA",
  authDomain: "mediareviews-3cf32.firebaseapp.com",
  databaseURL: "https://mediareviews-3cf32-default-rtdb.firebaseio.com/",
  projectId: "mediareviews-3cf32",
  storageBucket: "gs://mediareviews-3cf32.firebasestorage.app",
  messagingSenderId: "324432751049",
  appId: "1:324432751049:web:37e669334f3480dfc02018",
  measurementId: "G-6S9Z1797KR"
};



const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getDatabase(app);