"use strict";

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const { body, validationResult } = require("express-validator");
const admin = require("firebase-admin");
const { Pool } = require("pg");

const aiService = require("./services/aiService");

const app = express();
const PORT = process.env.PORT || 8080;

// 1. GLOBAL SETTINGS & SECURITY
app.set("trust proxy", 1);
app.disable("x-powered-by"); // Hide backend technology

app.use(cors({
  origin: true, // Allow all origins for the hackathon
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://www.gstatic.com", "https://*.firebaseapp.com", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https://*.googleusercontent.com", "https://www.gstatic.com"],
        connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com", "https://*.firebaseapp.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  }),
);

app.use(compression());
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname), { 
  maxAge: "1d",
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
  }
}));

// 2. DATABASE & FIREBASE INIT
if (admin.apps.length === 0) {
  try {
    admin.initializeApp();
  } catch (e) {
    console.warn("Firebase Admin Init Warning:", e.message);
  }
}

const dbPool = new Pool({
  host: process.env.ALLOYDB_HOST || "localhost",
  user: process.env.ALLOYDB_USER || "admin",
  password: process.env.ALLOYDB_PASSWORD || "secret",
  database: process.env.ALLOYDB_NAME || "learning_data",
  max: 20,
  idleTimeoutMillis: 30000,
});

// 3. AUTH MIDDLEWARE
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.split("Bearer ")[1];
  
  if (!token) {
    if (process.env.NODE_ENV === "development") {
      req.user = { uid: "dev-user-123" };
      return next();
    }
    return res.status(401).json({ error: "No authentication token provided" });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// 4. API ROUTES

// Health Check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP", timestamp: new Date().toISOString() });
});

// Firebase Config
app.get("/api/firebase-config", (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "pw-pune-warnup.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "pw-pune-warnup",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "pw-pune-warnup.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || "",
  });
});

// Feynman Evaluation
const evaluationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Assessment limit reached. Take a breath!" }
});

app.post("/api/evaluateFeynman", 
  authenticate,
  evaluationLimiter,
  [
    body("topic").isString().trim().isLength({ min: 2, max: 200 }),
    body("explanation").isString().trim().isLength({ min: 10, max: 2000 })
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Invalid input provided.", details: errors.array() });
    }

    try {
      const { topic, explanation } = req.body;
      const result = await aiService.evaluateFeynman(topic, explanation);

      // Async log to database (Non-blocking)
      dbPool.query(
        "INSERT INTO feynman_logs (user_id, topic, grade, mastered, created_at) VALUES ($1, $2, $3, $4, NOW())",
        [req.user.uid, topic, result.grade, result.isMastered]
      ).catch(err => console.error("DB Log Error:", err.message));

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// 5. ERROR HANDLING & FALLBACK
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ 
    error: "Internal Server Error", 
    message: process.env.NODE_ENV === "production" ? "An unexpected error occurred." : err.message 
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[PASS] Server ready on port ${PORT}`);
  });
}

module.exports = app;
