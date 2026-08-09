import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env?.VITE_FIREBASE_APP_ID || ''
};

export function hasFirebaseConfig() {
    return Boolean(
        firebaseConfig.apiKey &&
        firebaseConfig.projectId &&
        firebaseConfig.apiKey.trim() !== '' &&
        firebaseConfig.projectId.trim() !== ''
    );
}

let app = null;
let auth = null;
let db = null;

if (hasFirebaseConfig()) {
    try {
        app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);
        db = getFirestore(app);
    } catch (err) {
        console.warn("Failed to initialize Firebase:", err);
        app = null;
        auth = null;
        db = null;
    }
}

export function getDb() {
    return db;
}

export function getAuthInstance() {
    return auth;
}

export function getCurrentUser() {
    return auth ? auth.currentUser : null;
}

export async function signInWithGoogle() {
    if (!hasFirebaseConfig() || !auth) {
        throw new Error("Firebase authentication is not configured.");
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return await signInWithPopup(auth, provider);
}

export async function signOutUser() {
    if (!auth) return Promise.resolve();
    return await signOut(auth);
}

export function onAuthStateChange(callback) {
    if (!hasFirebaseConfig() || !auth) {
        // Asynchronously invoke callback with null user for unconfigured environment
        setTimeout(() => callback(null), 0);
        return () => {};
    }
    return onAuthStateChanged(auth, callback);
}
