# SONORA — AI Music Analyzer v2

Web app (HTML/CSS/JS + Node/Express) that accepts public YouTube / YouTube Music URLs.

## Setup
1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Optional: add `YOUTUBE_API_KEY` for YouTube duration metadata.
5. Run `npm start` and open `http://localhost:3000`.

## YouTube URL analysis
This experimental version proxies requests to the public Magic Chords API:
- `POST /api/analyze` submits a public YouTube URL to `/api/v1/analyze/url`.
- `GET /api/jobs/:jobId` polls status and fetches `/result` after completion.
- The browser talks only to this app's backend because provider docs say browser CORS is disabled by default.

Provider documentation: https://magic-chords.dev/api

The provider docs currently state anonymous per-IP quotas (12 heavy submissions/hour, 2 concurrent jobs), no YouTube cookie authentication, and that job IDs act as capability tokens. Provider availability, terms and response schema may change. Use only content you are authorized to process. Confirm provider terms and applicable YouTube terms before production use.

OpenAI is optional and is used only to explain already-measured features. It does not extract audio from YouTube. The UI maps common result field names; adjust `public/app.js` if the provider response schema differs.
