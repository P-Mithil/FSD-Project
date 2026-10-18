# ResuMate: Live Jobs

Mithil's third Live Jobs milestone displays real listings in responsive cards with title, company, location, employment type, available salary text and a source Apply button. Company initials provide a fallback where logos are unavailable. Loading, empty-feed and API-error messages remain. Filters, resume matching, percentages and animations are not included yet.

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

`src/main.jsx` starts React, `src/App.jsx` selects the route, and `src/pages/Jobs.jsx` contains the page. Shared styles stay in `src/App.css`; listing styles are in `src/pages/Jobs.css`.

## Jobs API

`src/jobs.js` requests the public Dev Global Jobs API directly from the browser. No API key or backend is needed for this milestone. The fixed request asks for up to 100 India technology listings. There are no user-facing filters, pagination or resume-based recommendations yet. Listings may require different experience levels; an India feed tag is not a guarantee of eligibility.

The adapter reuses the working ResuMate project's field mapping, safe source-link handling and duplicate/expired-listing checks. Missing fields are labeled rather than invented. React renders provider text as plain text. Requests time out after 15 seconds and are cancelled when the page unmounts; failures are not retried automatically.

Visible attribution and each supplied Dev Global Jobs application URL are preserved. The provider permits internal, research and non-commercial use within its rate limit; see its [API documentation and usage terms](https://devglobaljobs.com/developers). An internet connection is needed to load listings. Reload the page to try again after a failure.

## Tests

```sh
npm test
```

Tests use controlled API responses for successful listings, empty feeds, provider failures, missing fields, unsafe links and salary mapping. They do not depend on live job availability.

Cards use two columns on desktop and one on mobile. Apply buttons preserve the provider URL and open it in a new tab. Salary text is shown as supplied; missing salaries say "Not listed", without guessing currency or pay period. Company initials are decorative; the full company name remains visible. No logo requests or additional dependencies are needed.
