import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User, Auth } from "firebase/auth";
import { getFunctions, Functions } from "firebase/functions";
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

// Validate Firebase configuration
function validateFirebaseConfig() {
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
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  return true;
}

// Validate configuration before initializing
validateFirebaseConfig();

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize with error handling
export let app: FirebaseApp;
export let auth: Auth;
export let db: Firestore;
export let functionsClient: Functions;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  const functionsRegion = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "us-central1";
  functionsClient = getFunctions(app, functionsRegion);
} catch (error) {
  console.error('Firebase initialization failed:', error);
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Failed to initialize Firebase: ${errorMessage}`);
}

// Auth helpers
export const firebaseSignIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const firebaseSignUp = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const firebaseSignOut = () => signOut(auth);

export const onAuthChange = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback);

// Firestore helpers
export const getCollection = async <T extends DocumentData>(
  collectionName: string,
  ...queryConstraints: QueryConstraint[]
): Promise<(T & { id: string })[]> => {
  const q = query(collection(db, collectionName), ...queryConstraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T & { id: string }));
};

export const getDocument = async <T extends DocumentData>(
  collectionName: string,
  docId: string
): Promise<(T & { id: string }) | null> => {
  const docRef = doc(db, collectionName, docId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as T & { id: string };
};

export const addDocument = async <T extends DocumentData>(
  collectionName: string,
  data: T
): Promise<string> => {
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
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, data as DocumentData);
};

export const deleteDocument = async (
  collectionName: string,
  docId: string
): Promise<void> => {
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
