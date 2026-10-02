# ResuMate: Live Jobs setup

Mithil's first Live Jobs milestone contains the React application setup and a minimal Jobs page. It does not include job data, APIs, cards, filters, matching or animations.

## Run locally

Use Node.js 22.13 or later. From the project root:

```sh
npm install
npm run dev
```

Open `http://localhost:5173/jobs`. The root URL `/` also displays Jobs during this milestone. Other paths display a not-found message. Routing currently uses the browser pathname and ordinary links; no routing dependency is needed for this single page.

## Build

```sh
npm run build
npm run preview
```

Vite serves the page routes locally. A future static deployment must forward page requests to `index.html`.

`src/main.jsx` starts React, `src/App.jsx` selects the route, and `src/pages/Jobs.jsx` contains the page. Styles stay in `src/App.css`.
