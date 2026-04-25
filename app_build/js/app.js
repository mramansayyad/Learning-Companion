"use strict";

import { initFirebase } from "./firebase-config.js";

/**
 * UI Controller for the Learning Companion application.
 * Manages state transition and secure DOM manipulation.
 */
class UIController {
  constructor() {
    this.elements = {
      authOverlay: document.getElementById("auth-overlay"),
      appContainer: document.getElementById("app-container"),
      loginBtn: document.getElementById("login-btn"),
      logoutBtn: document.getElementById("logout-btn"),
      topicInput: document.getElementById("topic-input"),
      explanationInput: document.getElementById("explanation-input"),
      submitBtn: document.getElementById("submit-explanation"),
      evaluationResult: document.getElementById("evaluation-result"),
      masteredCountEl: document.getElementById("mastered-count"),
    };
    
    this.auth = null;
    this.db = null;
    this.provider = null;
    this.currentUser = null;
  }

  /**
   * Initializes the UI and Firebase listeners.
   */
  async init() {
    try {
      const fb = await initFirebase();
      this.auth = fb.auth;
      this.db = fb.db;
      this.provider = fb.provider;

      this.setupListeners();
    } catch (err) {
      this.showGlobalError(`Initialization Failed: ${err.message}`);
    }
  }

  setupListeners() {
    this.auth.onAuthStateChanged((user) => this.handleAuthStateChange(user));
    this.elements.loginBtn.addEventListener("click", () => this.login());
    this.elements.logoutBtn.addEventListener("click", () => this.logout());
    this.elements.submitBtn.addEventListener("click", () => this.handleFeynmanSubmit());
  }

  handleAuthStateChange(user) {
    if (user) {
      this.currentUser = user;
      this.elements.authOverlay.classList.add("hidden");
      this.elements.appContainer.classList.remove("hidden");
      this.loadUserStats();
    } else {
      this.currentUser = null;
      this.elements.authOverlay.classList.remove("hidden");
      this.elements.appContainer.classList.add("hidden");
    }
  }

  async login() {
    try {
      await this.auth.signInWithPopup(this.provider);
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  logout() {
    this.auth.signOut();
  }

  async loadUserStats() {
    if (!this.currentUser) return;
    const userRef = this.db.collection("users").doc(this.currentUser.uid);

    userRef.onSnapshot((doc) => {
      if (doc.exists) {
        this.elements.masteredCountEl.textContent = doc.data().masteredCount || 0;
      } else {
        userRef.set({ masteredCount: 0 });
      }
    });
  }

  async handleFeynmanSubmit() {
    const topic = this.elements.topicInput.value.trim();
    const explanation = this.elements.explanationInput.value.trim();

    if (!topic || !explanation) {
      this.showToast("Both topic and explanation are required.", "warning");
      return;
    }

    this.setLoadingState(true);
    this.clearEvaluation();

    try {
      const token = await this.currentUser.getIdToken();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch("/api/evaluateFeynman", {
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
        const errorData = await response.json().catch(() => ({ error: "Server failed to respond." }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      this.renderEvaluation(data);
      this.logSession(topic, data);
    } catch (err) {
      this.showEvaluationError(err.message === "signal is aborted without reason" ? "Request timed out." : err.message);
    } finally {
      this.setLoadingState(false);
    }
  }

  setLoadingState(isLoading) {
    this.elements.submitBtn.disabled = isLoading;
    this.elements.submitBtn.textContent = isLoading ? "Refining Logic..." : "Evaluate via AI";
    this.elements.evaluationResult.setAttribute("aria-busy", isLoading ? "true" : "false");
  }

  clearEvaluation() {
    this.elements.evaluationResult.textContent = "";
    const p = document.createElement("p");
    p.className = "placeholder-text";
    p.textContent = "AI is analyzing your mental model...";
    this.elements.evaluationResult.appendChild(p);
  }

  renderEvaluation(data) {
    const { grade, feedback, isMastered } = data;
    this.elements.evaluationResult.textContent = "";

    const h4 = document.createElement("h4");
    h4.className = isMastered ? "neon-text-cyan" : "neon-text-purple";
    h4.textContent = `Grade: ${grade}`;

    const p = document.createElement("p");
    p.className = "evaluation-feedback";
    p.textContent = feedback;

    this.elements.evaluationResult.appendChild(h4);
    this.elements.evaluationResult.appendChild(p);
  }

  showEvaluationError(msg) {
    this.elements.evaluationResult.textContent = "";
    const p = document.createElement("p");
    p.className = "error-text";
    p.textContent = `Error: ${msg}`;
    this.elements.evaluationResult.appendChild(p);
  }

  showToast(message, type = "info") {
    // Simple toast implementation (could be expanded)
    console.log(`[${type.toUpperCase()}] ${message}`);
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  showGlobalError(msg) {
    const errDiv = document.createElement("div");
    errDiv.className = "global-error";
    errDiv.textContent = msg;
    document.body.prepend(errDiv);
  }

  async logSession(topic, data) {
    try {
      await this.db.collection("users").doc(this.currentUser.uid).collection("sessions").add({
        topic,
        grade: data.grade,
        isMastered: data.isMastered,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn("Session logging failed (local only):", e.message);
    }
  }
}

const app = new UIController();
app.init();
