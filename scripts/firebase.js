import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAKGL7v8zhVHFsoV_AWwgAshiWmv8v84yA",
  authDomain: "mediareviews-3cf32.firebaseapp.com",
  // ...other config values from Firebase Console...
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);