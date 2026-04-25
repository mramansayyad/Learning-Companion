"use strict";

const express = require("express");
const path = require("path");
const { VertexAI } = require("@google-cloud/vertexai");
const admin = require("firebase-admin");
const { Pool } = require("pg");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 8080;

// Security & Efficiency Middlewares
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    contentSecurityPolicy: false,
  }),
);
app.use(compression());

// Rate Limiting to prevent abusive traffic to Gemini
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
});

// Enforce strict JSON parsing limits
app.use(express.json({ limit: "10kb" }));

// Serve static frontend with caching for efficiency (1 day max-age)
app.use(express.static(path.join(__dirname), { maxAge: "1d" }));

// Dummy initialization for Firebase admin to pass tests locally without credentials
if (admin.apps.length === 0) {
  try {
    admin.initializeApp();
  } catch (e) {
    console.warn("Firebase admin initialization warning: ", e.message);
  }
}

// Configuration for AlloyDB (Replace with Secret Manager values in production)
const dbPool = new Pool({
  host: process.env.ALLOYDB_HOST || "localhost",
  user: process.env.ALLOYDB_USER || "admin",
  password: process.env.ALLOYDB_PASSWORD || "secret",
  database: process.env.ALLOYDB_NAME || "learning_data",
});

// Setup Vertex AI (Gemini 3.1 Pro)
const project = process.env.GCP_PROJECT || "pw-pune-warmup";
const location = "us-central1";
const vertexAi = new VertexAI({ project: project, location: location });
const generativeModel = vertexAi.getGenerativeModel({
  model: "gemini-3-flash",
});

/**
 * Authenticates the request via Firebase Admin using the supplied Bearer token.
 * @param {express.Request} req - The Express request object containing the Authorization header.
 * @returns {Promise<admin.auth.DecodedIdToken | { uid: string }>} Resolves with the decoded user payload.
 */
async function authenticate(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.split("Bearer ")[1];
  if (!token) {
    if (process.env.NODE_ENV === "development") return { uid: "test-user-123" };
    throw new Error("Unauthorized");
  }
  return admin.auth().verifyIdToken(token);
}

/**
 * Core Evaluator Endpoint execution utilizing the Gemini 3.1 Pro model.
 * Handles strict rate-limiting, input sanitization, and AlloyDB logging asynchronously.
 * @param {express.Request} req - The Express request object.
 * @param {express.Response} res - The Express response object.
 * @returns {Promise<void>}
 */
app.post("/api/evaluateFeynman", apiLimiter, async (req, res) => {
  try {
    const user = await authenticate(req);
    let { topic, explanation } = req.body;

    // Strict Input Validation & Type Checking
    if (
      !topic ||
      typeof topic !== "string" ||
      !explanation ||
      typeof explanation !== "string"
    ) {
      return res
        .status(400)
        .json({ error: "Missing or malformed topic/explanation strings." });
    }

    if (topic.length > 200 || explanation.length > 2000) {
      return res
        .status(400)
        .json({ error: "Input exceeds maximum permitted length constraints." });
    }

    // Basic XSS & Injection Sanitization via entity encoding
    const sanitizeInput = (str) =>
      String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    topic = sanitizeInput(topic);
    explanation = sanitizeInput(explanation);

    const prompt = `
      System Context: You are a strict, Socratic tutor powered by Gemini 3.1 Pro executing the Feynman Technique engine. 
      Objective: Evaluate the student's explanation. DO NOT impart direct answers under any circumstance. Provide scaffolding hints.
      
      Topic: "${topic}"
      Explanation: "${explanation}"

      Execution Directives:
      1. Logic Check: Map hallucinated concepts or gaps in fundamental understanding.
      2. Scaffolding Phase: Ask exactly 1 probing, Socratic question to guide the student toward the correct mental model.
      3. Grading: Assign a strict score out of 10. (Mastered = 8+).
      
      Output strictly as raw JSON:
      {
        "grade": "X/10",
        "feedback": "<scaffolding_hint_or_question>",
        "isMastered": boolean
      }
    `;

    const chatResponse = await generativeModel.generateContent(prompt);
    let rawText = chatResponse.response.candidates[0].content.parts[0].text;
    rawText = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const evaluation = JSON.parse(rawText);

    // Asynchronous background metric recording into AlloyDB
    dbPool
      .query(
        `INSERT INTO feynman_logs (user_id, topic, grade, mastered, created_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
        [user.uid, topic, evaluation.grade, evaluation.isMastered],
      )
      .catch((err) => {
        console.error("AlloyDB Error - non block", err);
      });

    res.status(200).json(evaluation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Evaluation engine failed." });
  }
});

// Dynamic Config Injection Endpoint for Frontend Firebase setup
app.get("/api/firebase-config", (req, res) => {
  console.log(
    "Firebase Config requested. Project ID:",
    process.env.FIREBASE_PROJECT_ID,
  );

  const config = {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain:
      process.env.FIREBASE_AUTH_DOMAIN || "pw-pune-warnup.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "pw-pune-warnup",
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ||
      "pw-pune-warnup.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || "",
  };

  if (!config.apiKey) {
    console.error(
      "Critical Warning: FIREBASE_API_KEY is null or undefined in backend env vars.",
    );
  }

  res.setHeader("Content-Type", "application/json");
  return res.status(200).json(config);
});

// Fallback to index.html for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
