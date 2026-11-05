# ResuMate

ResuMate combines the team's homepage, document uploads, AI resume analysis and Live Jobs matching. It uses React, Vite and a small Express backend, with no database or login.

| Page | Purpose |
| --- | --- |
| `/` | Original black/red homepage, Outfit font, Spline robot, About section and scroll preview |
| `/analyze` | Resume/JD upload, analysis score, annotations, strengths and improvements |
| `/jobs` | Indian technology listings, filters, matching percentages and skill comparisons |

## Run locally

Use Node.js 22.13 or later. Install dependencies with `npm ci`.

If `backend/.env` does not exist, copy `backend/.env.example` to it and add `OPENROUTER_API_KEY`, `GROQ_API_KEY`, or both. Keep this file local; never put keys in React or `VITE_` variables. The models are configurable with `OPENROUTER_MODEL` and `GROQ_MODEL`. The defaults use a free OpenRouter model and Groq's existing model; request quotas still apply. Paid models require credits.

Run these commands in separate terminals:

```sh
npm run dev
npm run dev:api
```

Open `http://localhost:5173`. Express listens on `127.0.0.1:3001`; Vite forwards `/api` requests to it. `npm run start:api` runs Express without file watching.

```sh
npm test
npm run build
npm run preview
```

`preview` serves the production frontend only. A deployed site must forward page requests to `index.html` and `/api` requests to the Express server. Direct page refresh works in Vite. In-memory text and results clear on refresh.

## How the code works

- `src/App.jsx` owns the shared Resume/JD text, analysis result, navigation and Jobs session cache. Links use browser history so moving between pages preserves that state.
- `src/pages/Home.jsx`, `Navbar.jsx` and `Preview.jsx` reproduce the reference design. Preview motion uses CSS and a simple scroll handler. The Spline robot loads from its original CDN and needs network access. Keyboard focus and reduced-motion preferences are supported.
- `Upload.jsx` and `JobsResume.jsx` manage their own filenames, loading and field errors. Both use `readDocument.js` for common reading/validation and `DocumentInput.jsx` for accessible inputs. Upload version checks stop older results from replacing newer input.
- `extractPdfText.js` uses PDF.js; `extractDocxText.js` uses Mammoth raw-text extraction. Files stay in browser memory. Limits are 5 MB, 20 PDF pages, 15,000 resume characters and 12,000 JD characters. PDF signatures and DOCX archive structure/expansion are validated. Scanned PDFs require pasted text; OCR is not included.

## Backend and scoring

`backend/server.js` registers all three routes with a 128 KB JSON limit and safe error handling:

| Endpoint | Workflow |
| --- | --- |
| `POST /api/analyze` | Receives `{ resumeText, jobDescription }`, compares AI responses server-side and returns the first validated result |
| `GET /api/jobs` | Fetches Dev Global Jobs listings and applies city, employment, date, remote and fresher filters |
| `POST /api/jobs/match` | Receives `{ resumeText, filters }`, compares source requirements with the resume and returns ranked results |

`backend/ai.js` runs the configured OpenRouter and Groq requests in parallel. `backend/analyze.js` uses the same prompt, evidence checks and scoring rules for either provider. Only the first fully validated response is returned; the other request is cancelled. One failed or rate-limited provider cannot hide a valid result from the other. If both fail, the form offers a manual retry and keeps the documents and previous results.

`src/matching.js` validates exact source evidence and applies the original fixed scoring rules. `reviewAnalysis.js` checks the response and quoted evidence before React renders it. A failed request never produces a sample result.

Analysis weights are required qualifications 45%, preferred qualifications 15%, projects 20%, experience 15% and resume evidence 5%. A criterion earns 1 for matched, 0.5 for partial and 0 for missing. Unsupported categories are excluded and remaining weights are redistributed. The total is rounded once. For the fictional sample, `round(60*.45 + 25*.15 + 100*.20 + 0*.15 + 100*.05) = 56`.

Jobs use the separate original `backend/score.js` rules: Skills 40%, Role 25%, Experience 20%, Location 10% and Education 5%. These compare a resume with source listings rather than the full submitted JD, so they serve a different purpose. Jobs matching runs in Express without sending the resume to the jobs provider or OpenRouter.

`backend/jobSources.js` normalizes Dev Global Jobs data and preserves original application URLs. `backend/jobs.js` caches profiles/results and bounds source/detail requests. Scored jobs rank highest first; unavailable scores are never zero. Partial descriptions have an explicit estimate label. Hover, keyboard focus and mobile expansion reveal scores and skill evidence. Future-dated, expired and ineligible listings are excluded using the system clock.

## Safety and verification

### Vercel deployment

Import `P-Mithil/FSD-Project` with `main` as the production branch. The root `vercel.json` selects Vite, `npm run build` and `dist`. API routing takes priority over static files and the SPA fallback, so `/analyze` and `/jobs` can be refreshed directly.

`api/index.js` exports the existing Express app without opening a listening port. AI handling stays in the backend and cannot bypass Express validation as a separate Function. Set the provider keys as Secrets in both Preview and Production; never use a `VITE_` prefix. The Function allows 120 seconds, each analysis attempt has a total 60-second deadline, and the browser allows 75 seconds.

Caches and server cooldowns are best-effort per warm instance. Cold starts or parallel instances may fetch again; no score or session requires those caches to survive. Browser session caching and cooldowns remain active, and each instance respects provider `Retry-After` responses without automatic retry loops. There is no shared global quota across instances. API responses use `Cache-Control: no-store` to keep resume results out of public CDN caches.

Verify a Preview deployment before production, including synthetic analysis and live jobs. Local tests alone do not prove that cloud provider access or environment variables work.

Missing keys, invalid documents, malformed AI output, timeouts and provider errors produce readable messages. Each provider's cooldown respects `Retry-After`; there is no automatic retry loop. The application allows at most one correction attempt per provider for invalid structured output. Previous results are preserved when requests fail. Keys and complete documents are not logged.

Scores are evidence-based estimates, not official ATS scores, hiring probabilities or independent verification of ability. Fictional sample data is retained only for regression tests.

Three focused tests cover AI response validation and parallel requests, jobs/scoring and caching, and document extraction/validation. They use synthetic fixtures in `tests/fixtures`; live providers and browser interactions still require separate checks.

If Node reports `CERT_NOT_YET_VALID`, check the backend computer's clock, timezone and time synchronization. Never disable TLS verification or change Git timestamps. `.env`, `node_modules`, `dist`, logs, caches and backups are excluded from Git.
