import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAKGL7v8zhVHFsoV_AWwgAshiWmv8v84yA",
  authDomain: "mediareviews-3cf32.firebaseapp.com",
  projectId: "mediareviews-3cf32",
  storageBucket: "mediareviews-3cf32.firebasestorage.app",
  messagingSenderId: "324432751049",
  appId: "1:324432751049:web:37e669334f3480dfc02018",
  measurementId: "G-6S9Z1797KR"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);