# ResuMate

Resume and Job Description upload with Nishal's first analysis UI milestone. Open `/analyze` (or `/`) to upload PDF/DOCX files or paste text. The original PDF.js and Mammoth helpers extract text in the browser. There are no backend calls, Groq requests or live scoring in this milestone.

## Run locally

Use Node.js 22.13 or later. From the project root:

```sh
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build

```sh
npm run build
npm run preview
```

`src/main.jsx` starts React, `src/App.jsx` contains the shared application shell, and `src/App.css` provides the base styles. A future static deployment must forward page requests to `index.html`.

## Document extraction

`App.jsx` holds both document texts in simple React state: `text.resume` and `text.job`. `Upload` receives `text` and `onTextChange(kind, value)` as props. `ReviewResults` receives those texts and an empty analysis value until the API is connected. It shows the actual resume and an unavailable score, not a fabricated result.

The original results component and relevant CSS are reused from the completed reference. “Show sample analysis” uses saved fictional results in `src/sampleAnalysis.json`, copied from that reference. This preview never evaluates the user's documents. Returning to documents or editing text exits the sample without changing uploaded text. The later backend milestones must supply validated analysis results to this same component.

Each input has independent filename, reading and error state. Selecting a new file replaces only that document after successful extraction. Pasting or editing text cancels stale upload results. Unreadable or empty documents show an error beside that input while preserving existing text. Refreshing clears this in-memory state; documents are not saved.

Files are limited to 5 MB, PDFs to 20 pages, resume text to 15,000 characters and JD text to 12,000. DOCX structure and expansion limits are checked before extraction. Scanned PDFs need pasted text because OCR is not included. Analyze remains disabled until the analysis API is connected.

Run `npm test` for document extraction and validation tests. No test framework dependency is required.
