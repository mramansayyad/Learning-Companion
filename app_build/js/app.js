"use strict";

// setup firebase objects globally

import { initFirebase } from "./firebase-config.js";

// DOM Elements
const authOverlay = document.getElementById("auth-overlay");
const appContainer = document.getElementById("app-container");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

const topicInput = document.getElementById("topic-input");
const explanationInput = document.getElementById("explanation-input");
const submitBtn = document.getElementById("submit-explanation");
const evaluationResult = document.getElementById("evaluation-result");
const masteredCountEl = document.getElementById("mastered-count");

const GEMINI_FUNCTION_URL = "/api/evaluateFeynman";

let currentUser = null;
let auth, db, provider;

/**
 * Initializes the frontend application, checks Firebase auth state, 
 * and binds event listeners for login and application triggers.
 * @returns {Promise<void>}
 */
async function bootstrap() {
  try {
    const fb = await initFirebase();
    auth = fb.auth;
    db = fb.db;
    provider = fb.provider;

    // Auth State Observer
    auth.onAuthStateChanged((user) => {
      if (user) {
        currentUser = user;
        authOverlay.classList.add("hidden");
        appContainer.classList.remove("hidden");
        loadUserStats();
      } else {
        currentUser = null;
        authOverlay.classList.remove("hidden");
        appContainer.classList.add("hidden");
      }
    });

    // Login / Logout
    loginBtn.addEventListener("click", () => {
      auth.signInWithPopup(provider).catch((err) => {
        console.error(err);
        authOverlay.innerHTML +=
          '<p style="color:red; text-align:center;">' + err.message + "</p>";
      });
    });

    logoutBtn.addEventListener("click", () => {
      auth.signOut();
    });

    submitBtn.addEventListener("click", handleFeynmanSubmit);
  } catch (err) {
    console.log("Firebase Init Error:", err);
    authOverlay.innerHTML += `<p style="color:red; text-align:center; padding:10px;">Error: ${err.message}</p>`;
  }
}

/**
 * Loads the user's Active Recall statistics natively from Firestore.
 * Listens to Realtime snapshots for any subsequent metric changes.
 * @returns {Promise<void>}
 */
async function loadUserStats() {
  if (!currentUser) return;
  const userRef = db.collection("users").doc(currentUser.uid);

  userRef.onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      masteredCountEl.textContent = data.masteredCount || 0;
    } else {
      userRef.set({ masteredCount: 0 });
    }
  });
}

/**
 * Handles the logic parsing, UI state updates, and secure HTTP integration 
 * to evaluate the student prompt via the Vertex AI / Gemini backend.
 * Uses an AbortController for network resiliency.
 * @returns {Promise<void>}
 */
async function handleFeynmanSubmit() {
  const topic = topicInput.value.trim();
  const explanation = explanationInput.value.trim();

  if (!topic || !explanation) {
    alert("Please provide both a topic and your explanation.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Evaluating with Gemini...";
  evaluationResult.innerHTML = "";
  evaluationResult.setAttribute("aria-busy", "true");
  
  const loadingP = document.createElement("p");
  loadingP.className = "placeholder-text";
  loadingP.textContent = "Analyzing logic and checking for gaps...";
  evaluationResult.appendChild(loadingP);

  try {
    const token = await currentUser.getIdToken();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // Call our Cloud Run Function
    const response = await fetch(GEMINI_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ topic, explanation }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();

    // Extract evaluation
    const { grade, feedback, isMastered } = data;

    // Render result securely using textContent to prevent XSS
    evaluationResult.innerHTML = "";
    
    const h4 = document.createElement("h4");
    h4.className = `neon-text-${isMastered ? "cyan" : "purple"}`;
    h4.textContent = `Grade: ${grade}`;
    
    const pNode = document.createElement("p");
    pNode.style.marginTop = "10px";
    pNode.style.whiteSpace = "pre-wrap";
    pNode.textContent = feedback;
    
    evaluationResult.appendChild(h4);
    evaluationResult.appendChild(pNode);

    // Active recall / Spaced Repetition log
    // We import firebase from CDN, meaning 'firebase.firestore.FieldValue' is globally available
    await db
      .collection("users")
      .doc(currentUser.uid)
      .collection("sessions")
      .add({
        topic,
        grade,
        isMastered,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
  } catch (err) {
    console.error(err);
    let errMsg = `Error during evaluation: ${err.message || err}`;
    if (err.name === "AbortError") {
      errMsg =
        "Request timed out after 15 seconds. Ensure Vertex AI and networking are correctly configured.";
    }
    evaluationResult.innerHTML = "";
    const errNode = document.createElement("p");
    errNode.style.color = "red";
    errNode.textContent = errMsg;
    evaluationResult.appendChild(errNode);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Evaluate via AI";
    evaluationResult.setAttribute("aria-busy", "false");
  }
}

// Start application process
bootstrap();
