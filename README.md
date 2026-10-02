# ResuMate

Shared React and Vite foundation for the team's feature branches. This setup contains the application entry point and base styles; feature pages and APIs are developed separately.

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
