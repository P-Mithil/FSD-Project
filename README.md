# ResuMate Live Jobs

React/Vite frontend and a small Express backend for Indian technology jobs. Dev Global Jobs is the only external provider. This branch contains the Jobs page, not the team's landing or Resume Analysis pages.

## Run

Use Node.js 22.13 or later. Run `npm install`, then start two terminals:

```sh
npm run dev:api
```

```sh
npm run dev
```

Open the Vite URL shown in the terminal at `/jobs`. `/` also opens Jobs. Vite forwards `/api` to Express at `127.0.0.1:3001`. No API key is needed. Optional backend settings are `HOST` and `PORT`; adjust the Vite proxy if changing the port.

```sh
npm test
npm run build
```

## How it works

- `src/App.jsx` selects the route. `components/JobsResume.jsx` manages resume uploads and session state. `pages/Jobs.jsx` displays filters, cards, scores and skill comparisons. `src/Jobs.css` contains the black/red Jobs styling.
- Paste resume text or upload a text-based PDF/DOCX, up to 5 MB and 15,000 extracted characters. PDFs are limited to 20 pages. PDF.js and Mammoth read files in the browser. Validation checks document bytes and DOCX expansion limits.
- `backend/server.js` exposes `GET /api/jobs` and `POST /api/jobs/match`. The POST accepts `{ "resumeText": "...", "filters": { "city": "", "type": "any", "days": "30", "level": "all" } }`.
- `backend/jobSources.js` fetches and validates listings. `backend/jobs.js` applies filters, caches profiles/results and handles provider errors. `backend/score.js` extracts skills and calculates scores. There are no AI calls, database or login.
- Weights are skills 40%, role 25%, experience 20%, location 10% and education 5%. Inapplicable weights are redistributed. Unknown resume evidence earns no credit. Explicitly ineligible jobs are excluded.
- All returned jobs appear in descending score order, with unavailable scores last. Incomplete descriptions can produce labeled estimates from explicit available requirements. Descriptions without sufficient evidence receive no score. Percentages estimate compatibility, not hiring probability.
- The source pool is bounded to 200 listings and 20 detail requests per search. The default posting window is 30 days. Expired, future-dated and unsafe listings are excluded. Source dates and availability can limit results.
- Matching happens in Express; only a derived role/technology query goes to the external provider. Uploaded documents are not saved. Resume text and frontend results last only for the session; refreshing requires uploading again. Requests are cached and rate-limit cooldowns do not trigger automatic retries.

## Deployment and checks

Deploy `dist` with an `index.html` fallback for `/jobs`, and proxy `/api` to the Express server (`npm run start:api`). `npm run preview` previews the built frontend and needs an API proxy configured separately.

Tests use Node's built-in test runner and cover matching, ranking, partial evidence, filters, validation, source errors and cooldowns. The small DOCX fixture is required by the document-validation tests. No test framework packages are installed. Generated files, logs, caches and secrets are excluded by `.gitignore`.

Internet access is required for live listings and Google Fonts Outfit. Preserve [Dev Global Jobs attribution and application URLs](https://devglobaljobs.com/developers). No listings or private resumes are bundled with the application.
