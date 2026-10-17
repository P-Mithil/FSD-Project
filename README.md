# ResuMate

Sanjay's Resume and Job Description upload feature. Open `/analyze` (or `/`) to upload PDF/DOCX files or paste text. The original PDF.js and Mammoth helpers extract text in the browser; there are no backend calls or AI-analysis features in this milestone.

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

Each input has independent text, filename, reading and error state. Selecting a new file replaces only that document after successful extraction. Pasting or editing text cancels stale upload results. Unreadable or empty documents show an error while preserving existing text.

Files are limited to 5 MB, PDFs to 20 pages, resume text to 15,000 characters and JD text to 12,000. DOCX structure and expansion limits are checked before extraction. Scanned PDFs need pasted text because OCR is not included. Analyze and sample-result buttons remain disabled until the analysis feature is connected.

Run `npm test` for document extraction and validation tests. No test framework dependency is required.
