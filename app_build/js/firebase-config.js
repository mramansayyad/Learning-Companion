// firebase-config.js
// Set up Firebase configuration for pw-pune-warmup project

const firebaseConfig = {
  apiKey: "AIzaSy_REPLACE_WITH_YOUR_FIREBASE_API_KEY",
  authDomain: "pw-pune-warmup.firebaseapp.com",
  projectId: "pw-pune-warmup",
  storageBucket: "pw-pune-warmup.appspot.com",
  messagingSenderId: "REPLACE_WITH_SENDER_ID",
  appId: "REPLACE_WITH_APP_ID"
};

// Initialize Firebase only if the app hasn't been initialized yet
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();

// Provider setup for Active Recall Identity
export const provider = new firebase.auth.GoogleAuthProvider();
