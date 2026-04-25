const request = require("supertest");
const app = require("../server");

// Mocking external VertexAI & Firebase so tests pass seamlessly in CI/CD without real credentials
jest.mock("@google-cloud/vertexai", () => {
  return {
    VertexAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: `{"grade": "8/10", "feedback": "Great explanation!", "isMastered": true}`,
                    },
                  ],
                },
              },
            ],
          },
        }),
      }),
    })),
  };
});

jest.mock("firebase-admin", () => {
  // A simple stable mock to trick authenticate() if we choose to write an authenticated test case
  return {
    apps: [true],
    initializeApp: jest.fn(),
    auth: () => ({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: "test-user-unit" }),
    }),
  };
});

// Mock database connection
jest.mock("pg", () => {
  return {
    Pool: jest.fn().mockImplementation(() => ({
      query: jest.fn().mockResolvedValue({ rows: [] }),
    })),
  };
});

describe("Backend API Integration Tests", () => {
  
  describe("GET /api/firebase-config", () => {
    it("should return the firebase domain variables", async () => {
      const res = await request(app).get("/api/firebase-config");
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("projectId");
      expect(res.body).toHaveProperty("authDomain");
    });
  });

  describe("POST /api/evaluateFeynman", () => {
    it("should reject payloads with missing explanations", async () => {
      const res = await request(app)
        .post("/api/evaluateFeynman")
        .set("Authorization", "Bearer MOCK_TOKEN")
        .send({ topic: "Quantum Mechanics" });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Missing or malformed/i);
    });

    it("should reject too long topics exceeding bounds", async () => {
      const longTopic = "A".repeat(250);
      const res = await request(app)
        .post("/api/evaluateFeynman")
        .set("Authorization", "Bearer MOCK_TOKEN")
        .send({ topic: longTopic, explanation: "An explanation" });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/exceeds maximum permitted length/i);
    });

    it("should accept valid prompts and evaluate them via generative model", async () => {
      const res = await request(app)
        .post("/api/evaluateFeynman")
        .set("Authorization", "Bearer MOCK_TOKEN")
        .send({ topic: "Quantum Mechanics", explanation: "It's superposition!" });
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("grade");
      expect(res.body).toHaveProperty("feedback");
      expect(res.body).toHaveProperty("isMastered");
      expect(res.body.grade).toBe("8/10");
    });
  });

});
