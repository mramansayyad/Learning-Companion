import { auth, provider, db } from './firebase-config.js';

// DOM Elements
const authOverlay = document.getElementById('auth-overlay');
const appContainer = document.getElementById('app-container');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

const topicInput = document.getElementById('topic-input');
const explanationInput = document.getElementById('explanation-input');
const submitBtn = document.getElementById('submit-explanation');
const evaluationResult = document.getElementById('evaluation-result');
const masteredCountEl = document.getElementById('mastered-count');

// Evaluate path for unified Express hosting
const GEMINI_FUNCTION_URL = '/api/evaluateFeynman';

let currentUser = null;

// Auth State Observer
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    authOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
    loadUserStats();
  } else {
    currentUser = null;
    authOverlay.classList.remove('hidden');
    appContainer.classList.add('hidden');
  }
});

// Login / Logout
loginBtn.addEventListener('click', () => {
  auth.signInWithPopup(provider).catch(err => console.error(err));
});

logoutBtn.addEventListener('click', () => {
  auth.signOut();
});

// Load Active Recall stats from Firestore
async function loadUserStats() {
  if (!currentUser) return;
  const userRef = db.collection('users').doc(currentUser.uid);
  
  userRef.onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      masteredCountEl.textContent = data.masteredCount || 0;
    } else {
      userRef.set({ masteredCount: 0 });
    }
  });
}

// Feynman Evaluation Trigger
submitBtn.addEventListener('click', async () => {
  const topic = topicInput.value.trim();
  const explanation = explanationInput.value.trim();

  if (!topic || !explanation) {
    alert("Please provide both a topic and your explanation.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Evaluating with Gemini...';
  evaluationResult.innerHTML = `<p class="placeholder-text">Analyzing logic and checking for gaps...</p>`;

  try {
    const token = await currentUser.getIdToken();
    
    // Call our Cloud Run Function
    const response = await fetch(GEMINI_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ topic, explanation })
    });

    if (!response.ok) throw new Error('Failed to evaluate via API');

    const data = await response.json();
    
    // Extract evaluation
    const { grade, feedback, isMastered } = data;
    
    // Render result
    evaluationResult.innerHTML = `
      <h4 class="neon-text-${isMastered ? 'cyan' : 'purple'}">Grade: ${grade}</h4>
      <p style="margin-top: 10px;">${feedback.replace(/\n/g, '<br/>')}</p>
    `;

    // Active recall / Spaced Repetition log
    await db.collection('users').doc(currentUser.uid).collection('sessions').add({
      topic,
      grade,
      isMastered,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

  } catch (err) {
    console.error(err);
    evaluationResult.innerHTML = `<p style="color: red;">Error during evaluation. See console.</p>`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Evaluate via AI';
  }
});
