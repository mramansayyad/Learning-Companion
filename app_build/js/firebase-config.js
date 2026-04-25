// firebase-config.js
// Setup Firebase configuration dynamically for the active project.
// setup firebase objects globally

export async function initFirebase() {
  if (!firebase.apps.length) {
    const res = await fetch('/api/firebase-config');
    if (!res.ok) {
      throw new Error(`Server fetch failed: ${res.status} ${res.statusText}`);
    }
    
    const firebaseConfig = await res.json();
    
    // Explicit Validation before passing to initialization mapping
    if (!firebaseConfig.apiKey) {
      throw new Error('Config object payload empty - check the Cloud Run env var deployments.');
    }
    
    firebase.initializeApp(firebaseConfig);
  }
  
  return {
    auth: firebase.auth(),
    db: firebase.firestore(),
    provider: new firebase.auth.GoogleAuthProvider()
  };
}
