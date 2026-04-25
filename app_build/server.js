const express = require('express');
const path = require('path');
const { VertexAI } = require('@google-cloud/vertexai');
const admin = require('firebase-admin');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname)));

// Dummy initialization for Firebase admin to pass tests locally without credentials
if (admin.apps.length === 0) {
  try {
    admin.initializeApp();
  } catch(e) {
    console.warn("Firebase admin initialization warning: ", e.message);
  }
}

// Configuration for AlloyDB (Replace with Secret Manager values in production)
const dbPool = new Pool({
  host: process.env.ALLOYDB_HOST || 'localhost',
  user: process.env.ALLOYDB_USER || 'admin',
  password: process.env.ALLOYDB_PASSWORD || 'secret',
  database: process.env.ALLOYDB_NAME || 'learning_data',
});

// Setup Vertex AI (Gemini 3.1 Pro)
const project = process.env.GCP_PROJECT || 'pw-pune-warmup';
const location = 'us-central1';
const vertexAi = new VertexAI({ project: project, location: location });
const generativeModel = vertexAi.getGenerativeModel({
  model: 'gemini-3.1-pro',
});

// Helper to authenticate request
async function authenticate(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    if (process.env.NODE_ENV === 'development') return { uid: 'test-user-123' };
    throw new Error('Unauthorized');
  }
  return admin.auth().verifyIdToken(token);
}

// Core Evaluator Endpoint (Replaces the raw Cloud Run Function)
app.post('/api/evaluateFeynman', async (req, res) => {
  try {
    const user = await authenticate(req);
    const { topic, explanation } = req.body;

    if (!topic || !explanation) {
      return res.status(400).json({ error: 'Missing topic or explanation' });
    }

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
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const evaluation = JSON.parse(rawText);

    // Asynchronous background metric recording into AlloyDB
    dbPool.query(
      `INSERT INTO feynman_logs (user_id, topic, grade, mastered, created_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [user.uid, topic, evaluation.grade, evaluation.isMastered]
    ).catch(err => {
      console.error('AlloyDB Error - non block', err);
    });

    res.status(200).json(evaluation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Evaluation engine failed.' });
  }
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
