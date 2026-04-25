"use strict";

const { GoogleGenAI } = require("@google/genai");
const winston = require("winston");

// Setup structured logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * AI Service for interacting with Google Gemini models.
 * Encapsulates prompt engineering and model execution logic.
 */
class AIService {
  constructor() {
    this.project = process.env.GCP_PROJECT || "pw-pune-warnup";
    this.location = "us-central1";
    this.modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash"; // Defaulting to stable 1.5 if 3 fails

    // Initialize with Vertex AI settings if project/location are provided
    // For Cloud Run, the environment is typically pre-authenticated
    this.genAI = new GoogleGenAI({
      vertexai: true,
      project: this.project,
      location: this.location
    });
  }

  /**
   * Evaluates a student's explanation using the Feynman Technique.
   * @param {string} topic - The topic being explained.
   * @param {string} explanation - The student's explanation.
   * @returns {Promise<Object>} The evaluation result.
   */
  async evaluateFeynman(topic, explanation) {
    try {
      logger.info("Starting Feynman evaluation", { topic });
      
      const prompt = `
        System Context: You are a strict, Socratic tutor executing the Feynman Technique engine. 
        Objective: Evaluate the student's explanation. DO NOT impart direct answers. Provide scaffolding hints.
        
        Topic: "${topic}"
        Explanation: "${explanation}"

        Output strictly as raw JSON:
        {
          "grade": "X/10",
          "feedback": "<scaffolding_hint_or_question>",
          "isMastered": boolean
        }
      `;

      const response = await this.genAI.models.generateContent({
        model: this.modelName,
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      const responseText = response.candidates[0].content.parts[0].text;
      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      
      const result = JSON.parse(cleanJson);
      logger.info("Evaluation successful", { topic, grade: result.grade });
      
      return result;
    } catch (error) {
      logger.error("AI Service Error", { 
        message: error.message, 
        stack: error.stack,
        topic 
      });
      throw new Error("The evaluation engine encountered an internal error.");
    }
  }
}

module.exports = new AIService();
