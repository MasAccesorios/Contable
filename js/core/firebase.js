import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField, runTransaction, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVMFbdn09ogudIGaD95GJsmWRzLsfCYCs",
  authDomain: "masaccesorios-contable.firebaseapp.com",
  projectId: "masaccesorios-contable",
  storageBucket: "masaccesorios-contable.firebasestorage.app",
  messagingSenderId: "845872300152",
  appId: "1:845872300152:web:0665e9a80a2bdb645aad8d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, signInWithEmailAndPassword, onAuthStateChanged, signOut };
export { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField, runTransaction, query, where, orderBy, limit };
