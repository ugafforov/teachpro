import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User, Auth } from "firebase/auth";
import { getFunctions, Functions } from "firebase/functions";
import { logError } from "./errorUtils";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  DocumentData,
  Firestore,
  QueryConstraint
} from "firebase/firestore";

// Validate Firebase configuration with graceful fallback
function validateFirebaseConfig(): { isValid: boolean; missingVars: string[] } {
  const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];

  const missingVars = requiredVars.filter(varName => {
    const value = import.meta.env[varName as keyof ImportMeta['env']];
    return !value || (typeof value === 'string' && value.trim() === '');
  });

  if (missingVars.length > 0) {
    const errorMsg = `Firebase configuration error: Missing required environment variables: ${missingVars.join(', ')}`;
    logError('firebase.validateConfig', errorMsg);

    // In development mode, throw error to alert developer
    // In production, allow graceful degradation
    if (import.meta.env.DEV) {
      throw new Error(errorMsg);
    }
  }

  return { isValid: missingVars.length === 0, missingVars };
}

// Validate configuration before initializing
const configValidation = validateFirebaseConfig();

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize with graceful degradation
export let app: FirebaseApp | null = null;
export let auth: Auth | null = null;
export let db: Firestore | null = null;
export let functionsClient: Functions | null = null;
export let isFirebaseInitialized = false;

if (configValidation.isValid) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    const functionsRegion = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "us-central1";
    functionsClient = getFunctions(app, functionsRegion);
    isFirebaseInitialized = true;
  } catch (error) {
    logError('firebase.init', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    // In production, don't crash - just log and continue with null values
    if (import.meta.env.DEV) {
      throw new Error(`Failed to initialize Firebase: ${errorMessage}`);
    }
  }
} else {
  logError('firebase.init', 'Firebase not initialized due to missing configuration');
}

// Auth helpers with null checks
export const firebaseSignIn = (email: string, password: string) => {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Please check your configuration.');
  }
  return signInWithEmailAndPassword(auth, email, password);
};

export const firebaseSignUp = (email: string, password: string) => {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Please check your configuration.');
  }
  return createUserWithEmailAndPassword(auth, email, password);
};

export const firebaseSignOut = () => {
  if (!auth) {
    return Promise.resolve();
  }
  return signOut(auth);
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  if (!auth) {
    // If auth is not initialized, call callback with null immediately
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

// Firestore helpers with null checks
export const getCollection = async <T extends DocumentData>(
  collectionName: string,
  ...queryConstraints: QueryConstraint[]
): Promise<(T & { id: string })[]> => {
  if (!db) {
    throw new Error('Firestore is not initialized. Please check your configuration.');
  }
  const q = query(collection(db, collectionName), ...queryConstraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T & { id: string }));
};

export const getDocument = async <T extends DocumentData>(
  collectionName: string,
  docId: string
): Promise<(T & { id: string }) | null> => {
  if (!db) {
    throw new Error('Firestore is not initialized. Please check your configuration.');
  }
  const docRef = doc(db, collectionName, docId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as T & { id: string };
};

export const addDocument = async <T extends DocumentData>(
  collectionName: string,
  data: T
): Promise<string> => {
  if (!db) {
    throw new Error('Firestore is not initialized. Please check your configuration.');
  }
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    created_at: Timestamp.now()
  });
  return docRef.id;
};

export const updateDocument = async <T extends Partial<DocumentData>>(
  collectionName: string,
  docId: string,
  data: T
): Promise<void> => {
  if (!db) {
    throw new Error('Firestore is not initialized. Please check your configuration.');
  }
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, data as DocumentData);
};

export const deleteDocument = async (
  collectionName: string,
  docId: string
): Promise<void> => {
  if (!db) {
    throw new Error('Firestore is not initialized. Please check your configuration.');
  }
  const docRef = doc(db, collectionName, docId);
  await deleteDoc(docRef);
};

// Re-export Firestore utilities for components
export {
  collection,
  doc,
  query,
  where,
  orderBy,
  Timestamp,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc
};

export type { User, DocumentData, QueryConstraint };
