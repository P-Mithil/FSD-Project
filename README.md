# ResuMate Live Jobs

Mithil's Jobs feature reuses the completed ResuMate interface and matching implementation. Dev Global Jobs is the only external source. The black/red theme, Outfit font, compact cards, filters and original hover/focus/tap score animations are preserved. Landing and Resume Analysis pages are outside this branch.

## Run locally

Use Node.js 22.13 or later. Install once:

```sh
npm install
```

Run these in two terminals from the project root:

```sh
npm run dev:api
```

```sh
npm run dev
```

Open the Vite URL printed in the terminal, followed by `/jobs`. `/` also opens Jobs. Vite forwards `/api` to Express on `127.0.0.1:3001`. No API key or .env file is required. Optional server settings are `HOST` and `PORT`; update the Vite proxy if changing the backend port.

```sh
npm test
npm run build
```

Production hosting must serve the built frontend with an index.html fallback for `/jobs` and forward `/api/jobs` and `/api/jobs/match` to Express. `npm run preview` previews the built UI; run the API separately and configure an API reverse proxy for a deployed preview. The development server is the easiest local demo.

## Frontend workflow

`src/App.jsx` chooses the Jobs route. `JobsResume.jsx` holds only Jobs resume text, upload state and the session response cache. `DocumentInput.jsx` accepts text, PDF or DOCX. The original PDF.js and Mammoth helpers extract text in the browser; documents are never saved or uploaded to a third-party service. Files must be valid, at most 5 MB, and extracted text must fit 15,000 characters. PDFs have a 20-page limit; scanned images need pasted text. DOCX archive validation limits decompression and checks the actual document content.

`Jobs.jsx` sends extracted text and filters to Express. It restores automatic matching after input settles, a manual Find my matches action, ranked recommendations, circular scores, expandable required/matched/missing skills and a factor breakdown. Unscored jobs stay in Explore Other Jobs with Not evaluated, never a fabricated zero. Hover and focus reveal the existing score without any request. Mobile tap, keyboard controls and reduced-motion styling are preserved. Refresh opens a fresh Jobs session; upload again to match. Resume data is not persisted in a database or browser storage.

## Express workflow

`backend/server.js` contains only Express setup and two routes:

- `GET /api/jobs?city=Bengaluru&type=any&days=7&level=all` browses eligible Indian technology listings.
- `POST /api/jobs/match` accepts JSON `{ "resumeText": "Skills: React, JavaScript...", "filters": { "city": "", "type": "any", "days": "7", "level": "all" } }` and returns `profile`, scored `results`, unscored `explore`, counts and safe warnings.

The three original modules are reused unchanged: `jobs.js` validates filters/resume text and orchestrates matching, `jobSources.js` fetches and normalizes Dev Global Jobs, and `score.js` extracts evidence and scores deterministically. There are no Groq calls, credentials, AI-analysis routes, databases or other providers. The superseded direct-browser jobs adapter and duplicated filters were removed.

The original source handling preserves attribution and original application links, rejects unsafe URLs and expired/future/overseas-only records, handles malformed responses, bounds searches to 200 listings and comparisons to 20 full descriptions, caches results/profiles, and respects provider Retry-After cooldowns without automatic retry loops. Partial results survive provider failures. Resume text is never sent to the external job source; only a derived technology/role search term is used. No complete resumes or personal information are logged.

## Matching calculation

Base weights: skills 40%, role 25%, experience 20%, location 10%, education 5%. Only applicable factors contribute to the denominator. Unknown applicant evidence earns no credit; factors absent from the job or an unselected location preference are inapplicable. Accepted alternative skills count as one requirement group. Explicitly ineligible listings are excluded. Identical evidence produces identical scores; ties use posting date and job ID.

Example from the live test: the React Native Developer listing required six skill groups. The test resume demonstrated five and matched the role. Experience, education and location were inapplicable, so the score was `round(100 * (40 * 5/6 + 25) / (40 + 25)) = 90`. AWS was missing. Missing or insufficient full descriptions return no score. These are estimated compatibility scores, not hiring probabilities or official ATS scores.

## Verification

- 44 tests pass: strong/partial/unrelated matching, accepted alternatives, applicable weights, stable ranking (including genuine zero versus null), missing descriptions, invalid input, source errors, partial 429 results/cooldowns, caching, filter aliases, safe links and PDF/DOCX validation/extraction.
- Production build passes; npm install reports zero known vulnerabilities.
- Actual live matching retrieved 34 source records, scored one 90% match, left three unscored, and excluded one explicitly ineligible candidate for a fictional mobile-developer resume with seven-day/All India filters. Counts are one observed search, not a claim about every source record.
- Browser checks verified required/matched/missing skills, genuine circular scores, unscored separation, keyboard focus, 1280px desktop and 390px mobile layouts without horizontal overflow, and successful `/jobs` refresh.
- A PDF upload with extracted text and live results was observed in Chrome. Actual DOCX bytes pass the extraction test. Automated chooser upload verification was restricted by browser file-access permissions; a manual DOCX picker check remains advisable. No extension/security settings were changed.
- Provider dates can be ahead of the computer date. Such records are excluded honestly; a broad browse can therefore be empty while a resume-derived search finds current older listings. Internet access and the external source's availability are required.

Visible attribution and original application URLs are preserved. See [Dev Global Jobs documentation and terms](https://devglobaljobs.com/developers). Outfit is loaded from Google Fonts. No job records, API keys, generated build output or private resumes are committed.

## Files in this milestone

- `README.md`
- `package.json`
- `package-lock.json`
- `vite.config.js`
- `src/App.jsx`
- `src/jobFilters.js` (superseded browser adapter removed)
- `src/jobs.js` (superseded browser adapter removed)
- `src/pages/Jobs.css`
- `src/pages/Jobs.jsx`
- `backend/jobs.js`
- `backend/jobSources.js`
- `backend/score.js`
- `backend/server.js`
- `src/components/DocumentInput.jsx`
- `src/components/JobsResume.jsx`
- `src/extractDocxText.js`
- `src/extractPdfText.js`
- `src/pdfValidation.js`
- `src/retry.js`
- `tests/docx.test.js`
- `tests/fixtures/resume.docx`
- `tests/job-filters.test.js`
- `tests/job-sources.test.js`
- `tests/jobs-api.test.js`
- `tests/jobs.test.js`
- `tests/pdf-validation.test.js`
- `tests/retry.test.js`
- `tests/smart-matching.test.js`
