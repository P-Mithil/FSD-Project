import { createApp } from "../backend/server.js";

// Reuse the same Express app on warm invocations; Vercel owns the HTTP server.
export default createApp();
