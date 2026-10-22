# ResuMate

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

Run `npm test` for document extraction and validation tests. No test framework dependency is required.
