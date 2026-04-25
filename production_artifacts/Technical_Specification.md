# Technical Specification: Learning Companion AI

## 1. Introduction and Objectives
This document asserts the architecture and technical requirements for a high-performance Learning Companion AI. Our objective is to deliver an adaptive, multimodal learning tool featuring active recall and the Feynman Technique validation loop. It will be built upon an ultra-lightweight Vanilla JS stack to ensure 10x performance improvements relative to traditional frameworks, incorporating high-velocity cloud services on the `pw-pune-warmup` GCP project.

## 2. Technical Stack and Philosophy
- **Frontend Core:** Vanilla JavaScript (ESM modules), HTML5, and raw CSS3. No heavy frameworks (React/Angular/Vue) will be utilized to maintain zero unnecessary dependency overhead.
- **Styling Architecture:** Glassmorphic design language.
  - Colors: Deep midnight background, Neon Cyan (`#00FFFF`) and Neon Purple (`#B026FF`) accents.
  - Features: CSS Grid/Flexbox, backdrop filters for glass effects, CSS custom properties for theming.

## 3. Mandatory Google Services Integration
The following services must strictly be incorporated inside the `pw-pune-warmup` Google Cloud Project environment:
1. **LLM Engine (Gemini 3.1 Pro):**
   - Utilized for the core reasoning engine, generating Feynman technique validation queries, simulating conversation, and understanding multimodal inputs.
   - Connected via Vertex AI Agent Builder or direct API.
2. **State & Auth (Firebase Auth & Firestore):**
   - **Firebase Auth:** Handles secure JWT generation, login, and identity propagation.
   - **Cloud Firestore:** Powers real-time state synchronization for active sessions, user settings, and rapid micro-interactions.
3. **Backend Logic (Cloud Run Functions):**
   - Scalable, event-driven functions executed via HTTP and Firestore triggers.
   - Responsible for agentic reasoning loops, API abstraction, and secure handling of external integrations.
4. **Data Analytics (AlloyDB for PostgreSQL):**
   - Handles the 100x faster analytical querying required for long-term user performance tracking, spaced repetition data metrics, and aggregated reporting.
5. **Observability (Cloud Logging and Error Reporting):**
   - Centralized, structured JSON logging mechanism ensuring exhaustive auditability.
6. **Security (Secret Manager):**
   - Strict segregation of secrets (API keys, database credentials) from the application codebase, securely provisioned at runtime across Cloud Run Functions.

## 4. Application Architecture
### 4.1 Feature 1: The Feynman Technique Engine
- **Mechanism:** User submits an explanation of a concept. The UI passes this to a Cloud Run Function.
- **Evaluation:** Gemini 3.1 Pro maps the explanation constraints, detects hallucinated logic, asks probing questions, and returns a grade.

### 4.2 Feature 2: Active Recall Loops
- **Mechanism:** Utilizing Firestore to record user response times and accuracy, seamlessly passing aggregated logs to AlloyDB. AlloyDB determines the optimal next recall intervals.

### 4.3 UI Structure
- `index.html`: Entry point for layout and glassmorphic shell.
- `app.js`: Root JS engine handling component lifecycles.
- `styles.css`: CSS Variables for Glassmorphic Neon themes, responsive layouts.
- `firebase-config.js`: Authentication and real-time connectivity context.

## 5. Security and QA Matrix
- **WCAG 2.1 Compliance:** Enforce exact contrast ratios for Neon elements alongside screen reader-friendly roles.
- **Authentication:** All requests verified strictly via Firebase tokens.

## 6. Infrastructure and CI/CD
- **Containerization:** UI elements and Functions deployed securely via automated hooks.
- **Deployment Hub:** `pw-pune-warmup` project endpoints. Managed by Cloud Build for automated QA verification.

---
**Status:** DRAFT | **Author:** Product Management | **Action Required:** Awaiting User Approval to commence Phase 2.
