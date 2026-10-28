# ResuMate

Moiz's first homepage milestone restores the original hero, black/red styling, Outfit typography, Spline robot scene, feature cards and About content. `/` shows the homepage; `/analyze` keeps Sanjay's upload and Nishal's analysis feature. Homepage CSS is scoped to avoid changing the analysis UI. The original Spline viewer loads from its CDN only when the homepage mounts; its scene requires network access.

Navigation enhancements, the original scroll-preview section and final responsive refinements remain for later homepage milestones. Jobs links retain their original `/jobs` destination for future integration; this branch does not contain Mithil's Jobs feature. No backend or scoring changes are included in this homepage milestone.

Resume and Job Description upload with Nishal's Groq integration milestone. Open `/analyze` (or `/`) to upload PDF/DOCX files or paste text. PDF.js and Mammoth extract text in the browser. Clicking Analyze Resume sends both texts to the Express backend, which calls Groq and validates the response before displaying it.

## Run locally

Use Node.js 22.13 or later. From the project root:

```sh
npm install
npm run dev
```

Open `http://localhost:5173`.

In a second terminal, copy `backend/.env.example` to `backend/.env`, add your own `GROQ_API_KEY`, then run:

```sh
npm run dev:api
```

The backend runs at `http://127.0.0.1:3001`; Vite forwards `/api` requests there. `npm run start:api` runs the backend without file watching. Keep the key in `backend/.env`, never in React or a `VITE_` variable. No database or Groq SDK is needed; Express is the only added dependency.

## Build

```sh
npm run build
npm run preview
```

`src/main.jsx` starts React, `src/App.jsx` contains the shared application shell, and `src/App.css` provides the base styles. A future static deployment must forward page requests to `index.html`.

## Document extraction

`App.jsx` holds both document texts in simple React state: `text.resume` and `text.job`. `Upload` receives `text` and `onTextChange(kind, value)` as props. The Analyze button posts `{ resumeText, jobDescription }` to `/api/analyze`. `ReviewResults` receives a validated response or an empty analysis value, which shows the actual resume and an unavailable score.

The original results component and relevant CSS are reused from the completed reference. “Show sample analysis” uses saved fictional results in `src/sampleAnalysis.json`, copied from that reference. This preview never evaluates the user's documents. A successful real response replaces the sample. Editing a document clears outdated results; request failures preserve the previous result.

Each input has independent filename, reading and error state. Selecting a new file replaces only that document after successful extraction. Pasting or editing text cancels stale upload results. Unreadable or empty documents show an error beside that input while preserving existing text. Refreshing clears this in-memory state; documents are not saved.

Files are limited to 5 MB, PDFs to 20 pages, resume text to 15,000 characters and JD text to 12,000. DOCX structure and expansion limits are checked before extraction. Scanned PDFs need pasted text because OCR is not included.

## Analysis backend

`backend/server.js` exposes only `/api/analyze`, accepts JSON text with a 128 KB body limit, and returns safe errors. `api/analyze.js` reuses the original Groq request, prompt, structured-output schema, 25-second provider timeout and at most one correction attempt for invalid output. Rate-limit responses are never automatically retried. The server and frontend respect `Retry-After`, using 60 seconds if it is absent.

`src/matching.js` and `src/reviewAnalysis.js` are the unchanged reference helpers required by that response contract: evidence must come from the submitted documents, JavaScript formats the existing deterministic result, and the frontend rejects invalid results. This milestone restores their required integration; detailed scoring refinements and presentation work remain for the following milestone. The duplicate annotation locator was removed from the results component.

Missing/invalid keys, rate limits, timeouts, network errors and malformed model output produce readable errors. Keys and complete documents are not logged. No Jobs or homepage code is included. For deployment, route `/api/analyze` to this Node backend and page requests to the frontend; the Vite proxy is for development only.

## Scores and feedback

The original scoring rules are unchanged: required qualifications 45%, preferred qualifications 15%, project relevance 20%, experience relevance 15%, and resume evidence 5%. Each criterion earns 1 for matched, 0.5 for partial or 0 for missing. A category's average earns its share of the total weight. Categories the JD does not support are excluded, and their weight is redistributed among applicable categories. Rounding happens once at the end.

For example, the saved fictional sample has category scores of 60%, 25%, 100%, 0%, and 100%. Its result is `round(60 × .45 + 25 × .15 + 100 × .20 + 0 × .15 + 100 × .05) = 56`. This demonstrates the formula, not a score for the user's documents.

Results show matched, partial and missing qualifications, source-linked annotations, up to three evidence-backed resume strengths, and three prioritized improvement suggestions. No fully matched evidence produces an explicit empty strengths message. AI interprets the documents; the weighted score is an estimate, not a hiring probability or independently measured ability. The frontend checks score consistency and quoted evidence against the shared Resume/JD text before rendering a real response.

If Node reports `CERT_NOT_YET_VALID`, compare the backend computer's date, time and timezone with the certificate's validity period. Check Windows automatic time synchronization and the Windows Time service. Do not disable certificate verification or change Git timestamps. A failed secure connection shows a readable error and preserves the previous result; it never creates a replacement score.

## Final integration check

The upload and analysis features share the same App text state; extraction and validation stay in the existing upload components. Groq is the only AI provider. The saved, clearly labeled sample remains useful for reviewing the UI offline and never replaces a failed live request automatically. The final cleanup reuses the existing requirement lookup for score deductions and consolidates duplicate result styles without changing the design.

Automated tests cover valid and malformed API responses, missing keys, rate limits, certificate failures, weighted scoring and feedback rendering. Live Groq verification still requires a configured local backend key and a valid TLS connection; a passing mocked test is not proof of live API access.

Run `npm test` for document extraction and validation tests. No test framework dependency is required.
