import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// ↓この行で GoogleAuthProvider をしっかり呼び出しています！
import { getAuth, GoogleAuthProvider } from "firebase/auth"; 

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCmcjWmpMsFPTYTT3GV0ScjGeoUlYWCItY",
  authDomain: "tamokuteki-kinouhakki-erp.firebaseapp.com",
  projectId: "tamokuteki-kinouhakki-erp",
  storageBucket: "tamokuteki-kinouhakki-erp.firebasestorage.app",
  messagingSenderId: "490373858529",
  appId: "1:490373858529:web:92b2380fc1a517d80a63a0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
// ↓上で呼び出したので、ここでエラーにならずに使えるようになります
export const googleProvider = new GoogleAuthProvider();
