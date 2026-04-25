const functions = require("@google-cloud/functions-framework");
const { VertexAI } = require("@google-cloud/vertexai");
const admin = require("firebase-admin");
const { Pool } = require("pg");

admin.initializeApp();

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
  model: "gemini-3.1-pro",
});

// Helper to authenticate request
async function authenticate(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.split("Bearer ")[1];
  if (!token) throw new Error("Unauthorized");
  return admin.auth().verifyIdToken(token);
}

functions.http("evaluateFeynman", async (req, res) => {
  // CORS Headers
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Max-Age", "3600");
    return res.status(204).send("");
  }

  try {
    const user = await authenticate(req);
    const { topic, explanation } = req.body;

    if (!topic || !explanation) {
      return res.status(400).json({ error: "Missing topic or explanation" });
    }

    // Agentic Prompt for Gemini 3.1 Pro
    const prompt = `
      You are an elite tutor testing the student's explanation using the Feynman Technique.
      Topic: "${topic}"
      Explanation: "${explanation}"

      1. Identify missing fundamental concepts or hallucinations.
      2. Ask exactly 1 probing question to test their actual knowledge limit.
      3. Grade them out of 10. (Mastered is 8 or above).
      
      Respond STRICTLY in JSON format:
      {
        "grade": "8/10",
        "feedback": "Your text here...",
        "isMastered": true
      }
    `;

    const chatResponse = await generativeModel.generateContent(prompt);
    let rawText = chatResponse.response.candidates[0].content.parts[0].text;

    // Clean up Markdown JSON fencing if present
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
        // Handled asynchronously to keep 10x API latency requirement
        console.error("AlloyDB Error", err);
      });

    res.status(200).json(evaluation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Evaluation engine failed." });
  }
});
