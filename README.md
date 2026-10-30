# ResuMate: Live Jobs

This Live Jobs correction preserves the completed ResuMate browse UI from `E:/FSD`: Outfit typography, the black/red theme, compact rows, original filters, hover transitions, keyboard focus, mobile tap-to-expand details and reduced-motion support. Real Dev Global Jobs listings, source Apply links, company initials, salary and error/empty states remain.

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

`src/main.jsx` starts React and `src/App.jsx` selects the route. `src/pages/Jobs.jsx` adapts the original Jobs page for browsing without resume state. `src/Jobs.css` is the preserved original Jobs stylesheet; `src/pages/Jobs.css` contains only the theme and shared control styles needed by this page. Unrelated landing and analysis code is not imported.

## Jobs API

`src/jobs.js` keeps the existing public API request directly in the browser. No API key, backend or new dependencies are needed for this milestone. The fixed request asks for up to 100 India technology listings. Filters apply locally within that pool; they do not search every vacancy in India. Show more reveals eight additional rows at a time without another API request.

The adapter reuses the original field mapping, safe links, plain-text descriptions, duplicate/expired checks and conservative India-remote eligibility checks. Missing fields and dates are labeled rather than invented. Requests time out after 15 seconds and are cancelled on unmount; errors offer a manual retry, with no automatic loop. Expandable details show the supplied description or excerpt, closing date when provided, and source attribution. Apply opens the original provider page for complete requirements.

Visible attribution and original application URLs are preserved. The provider permits internal, research and non-commercial use within its rate limit; see its [API documentation and usage terms](https://devglobaljobs.com/developers). An internet connection is required for listings and the original Google Fonts Outfit stylesheet.

## Tests

```sh
npm test
```

Tests use controlled responses for successful listings, empty feeds, provider failures, missing fields, unsafe links, salary, source descriptions and dates. Filter tests cover city aliases, custom cities, India remote, employment type, posting windows, fresher exclusions, expired listings and combined empty results.

## Filters and milestone boundaries

Choose city (including other Indian cities or India remote), employment type, posting window and experience level, then use Browse Indian jobs to apply. City aliases reuse the original rules, including Bangalore/Bengaluru and Delhi NCR. Freshers / junior mode excludes explicit senior titles; it does not prove experience eligibility. Check the source requirements before applying.

Future-dated postings and unsafe application URLs are excluded, matching the original source validation. Any date / date unavailable includes older or undated records, but never future postings. Source dates are never altered. A provider feed dated ahead of the computer can therefore produce an empty view.

A later matching milestone will restore resume upload/state, matching, genuine percentages, score rings, ranked recommendations and skill comparisons. This milestone has no resume controls or scoring logic. Rows say Not evaluated; this is not a zero score. The original stylesheet is preserved, including currently unused score styles, so future scoring can use the same design without another rewrite.

## UI and source correction

The Jobs card/filter stylesheet (`src/Jobs.css`) is identical to the original completed application. The Jobs-only shared styles restore the original content width, heading typography, brand header, footer and black/red colors (`#050505` and `#e53e50`). Home and Analyze navigation is intentionally absent until those pages exist in this checkout. Resume controls, matching and score percentages are deferred; cards remain Not evaluated.

Dev Global Jobs is the only external job source. There is no provider selector, fallback provider, AI request or API key in this branch. If an open page shows a Jobful/Himalayas selector, it is a different or stale application instance. Run Vite from this checkout and open the exact URL printed by Vite, rather than assuming an existing localhost tab belongs to this project.

Verification: `npm test` passes 16 tests and `npm run build` succeeds. On October 30, 2026, the unfiltered live endpoint returned 100 rows dated after the computer date; all were correctly excluded. A separate React query returned 34 records, including 31 non-future records. Those real source records were used only in an isolated browser test harness to exercise cards; the production request remains the India technology feed above. No listings or scores are bundled with the application.

Browser checks covered desktop (1280px) and mobile (390px) without horizontal overflow, city/custom-city filters, employment and fresher filters, posting windows, pagination, keyboard Enter/Escape, focus outlines, tap-to-expand details and preserved source links. Reduced-motion rules remain in the original stylesheet.
