const request = require("supertest");
const app = require("../server");

// Mocking @google/genai
jest.mock("@google/genai", () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [{ text: `{"grade": "9/10", "feedback": "Excellent explanation!", "isMastered": true}` }],
              },
            },
          ],
        }),
      },
    })),
  };
});

jest.mock("firebase-admin", () => ({
  apps: [true],
  initializeApp: jest.fn(),
  auth: () => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: "unit-test-uid" }),
  }),
}));

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
  })),
}));

describe("System Health & Security", () => {
  it("should have a functional health check endpoint", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("UP");
  });

  it("should enforce security headers (X-Powered-By check)", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("should have a Content-Security-Policy", async () => {
    const res = await request(app).get("/");
    expect(res.headers["content-security-policy"]).toBeDefined();
  });
});

describe("Evaluation API", () => {
  const validPayload = { 
    topic: "Neural Networks", 
    explanation: "They are models inspired by the human brain that solve complex patterns." 
  };

  it("should return firebase configuration variables", async () => {
    const res = await request(app).get("/api/firebase-config");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("projectId");
  });

  it("should reject invalid inputs with structured errors", async () => {
    const res = await request(app)
      .post("/api/evaluateFeynman")
      .set("Authorization", "Bearer MOCK_TOKEN")
      .send({ topic: "X", explanation: "Short" });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Invalid input provided.");
  });

  it("should evaluate a valid explanation successfully", async () => {
    const res = await request(app)
      .post("/api/evaluateFeynman")
      .set("Authorization", "Bearer MOCK_TOKEN")
      .send(validPayload);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.grade).toBe("9/10");
    expect(res.body.isMastered).toBe(true);
  });
});
