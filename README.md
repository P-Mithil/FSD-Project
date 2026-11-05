# ResuMate

ResuMate combines the team's homepage, document uploads, Groq resume analysis and Live Jobs matching. It uses React, Vite and a small Express backend, with no database or login.

| Page | Purpose |
| --- | --- |
| `/` | Original black/red homepage, Outfit font, Spline robot, About section and scroll preview |
| `/analyze` | Resume/JD upload, analysis score, annotations, strengths and improvements |
| `/jobs` | Indian technology listings, filters, matching percentages and skill comparisons |

## Run locally

Use Node.js 22.13 or later. Install dependencies with `npm ci`.

If `backend/.env` does not exist, copy `backend/.env.example` to it and add your own `GROQ_API_KEY`. Keep this file local; never put keys in React or `VITE_` variables. The original default model is `openai/gpt-oss-120b`.

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
| `POST /api/analyze` | Receives `{ resumeText, jobDescription }`, calls Groq server-side and validates evidence before returning results |
| `GET /api/jobs` | Fetches Dev Global Jobs listings and applies city, employment, date, remote and fresher filters |
| `POST /api/jobs/match` | Receives `{ resumeText, filters }`, compares source requirements with the resume and returns ranked results |

`api/analyze.js` contains the original Groq prompt, structured-output request and response handling. `src/matching.js` validates exact source evidence and applies the original fixed scoring rules. `reviewAnalysis.js` checks the response and quoted evidence before React renders it.

Analysis weights are required qualifications 45%, preferred qualifications 15%, projects 20%, experience 15% and resume evidence 5%. A criterion earns 1 for matched, 0.5 for partial and 0 for missing. Unsupported categories are excluded and remaining weights are redistributed. The total is rounded once. For the fictional sample, `round(60*.45 + 25*.15 + 100*.20 + 0*.15 + 100*.05) = 56`.

Jobs use the separate original `backend/score.js` rules: Skills 40%, Role 25%, Experience 20%, Location 10% and Education 5%. These compare a resume with source listings rather than the full submitted JD, so they serve a different purpose. Jobs matching runs in Express without sending the resume to the jobs provider or Groq.

`backend/jobSources.js` normalizes Dev Global Jobs data and preserves original application URLs. `backend/jobs.js` caches profiles/results and bounds source/detail requests. Scored jobs rank highest first; unavailable scores are never zero. Partial descriptions have an explicit estimate label. Hover, keyboard focus and mobile expansion reveal scores and skill evidence. Future-dated, expired and ineligible listings are excluded using the system clock.

## Safety and verification

Missing keys, invalid documents, malformed AI output, timeouts and provider errors produce readable messages. Rate limits respect `Retry-After`; there is no automatic retry loop. Groq allows at most one correction attempt for invalid structured output. Previous results are preserved when requests fail. Keys and complete documents are not logged.

Scores are evidence-based estimates, not official ATS scores, hiring probabilities or independent verification of ability. The sample preview is clearly labeled fictional and never substitutes automatically for failed live analysis.

The regression suite covers uploads, archive/signature validation, both scoring engines, evidence checks, ranking, date/location filters, cache reuse, API errors and all three routes in one Express app. Synthetic fixtures are used for deterministic tests; live providers still require separate checks.

If Node reports `CERT_NOT_YET_VALID`, check the backend computer's clock, timezone and time synchronization. Never disable TLS verification or change Git timestamps. `.env`, `node_modules`, `dist`, logs, caches and backups are excluded from Git.
