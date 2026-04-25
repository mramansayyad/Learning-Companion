'use strict';

const request = require('supertest');
const express = require('express');

// Create a mock app for testing routes in isolation
const app = express();
app.use(express.json());

// Mock rate limiter
const mockLimiter = (req, res, next) => next();

// Test evaluation endpoint
app.post('/api/evaluateFeynman', mockLimiter, async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let { topic, explanation } = req.body;

  if (!topic || typeof topic !== 'string' || !explanation || typeof explanation !== 'string') {
    return res.status(400).json({ error: 'Missing or malformed topic/explanation strings.' });
  }

  if (topic.length > 200 || explanation.length > 2000) {
    return res.status(400).json({ error: 'Input exceeds maximum permitted length constraints.' });
  }
  
  // Mock standard response
  res.status(200).json({
    grade: '8/10',
    feedback: 'Good job! Can you explain how it relates to interference?',
    isMastered: true
  });
});

describe('Feynman Engine Evaluation API', () => {
  it('should reject requests without authorization token', async () => {
    const res = await request(app)
      .post('/api/evaluateFeynman')
      .send({ topic: 'Quantum', explanation: 'It is small.' });
    expect(res.statusCode).toEqual(401);
  });

  it('should reject malformed or missing payloads', async () => {
    const res = await request(app)
      .post('/api/evaluateFeynman')
      .set('Authorization', 'Bearer mock-token-123')
      .send({ explanation: 'Missing topic' });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toMatch(/Missing or malformed/);
  });

  it('should return a 200 and evaluation on valid payload', async () => {
    const res = await request(app)
      .post('/api/evaluateFeynman')
      .set('Authorization', 'Bearer mock-token-123')
      .send({ topic: 'Quantum', explanation: 'It involves superposition.' });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('grade');
    expect(res.body).toHaveProperty('feedback');
    expect(res.body).toHaveProperty('isMastered');
  });

  it('should reject payloads exceeding maximum length constraints', async () => {
    const longString = 'a'.repeat(250);
    const res = await request(app)
      .post('/api/evaluateFeynman')
      .set('Authorization', 'Bearer mock-token-123')
      .send({ topic: longString, explanation: 'Valid explanation' });
    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toMatch(/exceeds maximum permitted length/);
  });
});
