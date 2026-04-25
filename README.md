# Learning Companion AI 🧠⚡

An ultra-performant, adaptive Learning Companion powered by **Gemini 3.1 Pro** utilizing the Feynman Technique and Spaced Repetition (Active Recall). Engineered purely on a Vanilla JS/Node.js stack achieving zero dependency bloat and wrapped in a premium Glassmorphic Neon UI targeting WCAG 2.1 AA standards.

## Google Cloud Services Integration Architecture

This repository relies strictly on native GCP integrations managed within `pw-pune-warmup`:

- **Gemini 3.1 Pro (Vertex AI):** Core reasoning engine utilizing Socratic scaffolding. Maps cognitive gaps in student explanations and generates targeted, non-answer-providing follow-up queries.
- **Cloud Run (Serverless):** Hosts the unified Express proxy and frontend assets in a zero-downtime, event-driven managed execution environment.
- **AlloyDB (PostgreSQL):** Analytical brain for Active Recall algorithms. Processes structured spaced-repetition logs with 100x optimized columnar/row-based querying.
- **Firebase Auth & Firestore:** Identity propagation and real-time state synchronization, enabling instantaneous micro-interactions across devices.
- **Secret Manager:** Production-grade security configuration for dynamic runtime injection of AlloyDB connection blocks.

## Development

```bash
# Setup
npm install

# Evaluate Locally (Requires default credentials configured for pw-pune-warmup)
npm start
```

## Production Deployment (CI/CD)
Managed via Google Cloud Build.
`gcloud run deploy learning-companion --source . --project pw-pune-warmup --region us-central1 --allow-unauthenticated`
