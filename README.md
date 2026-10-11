# Rosso Rubino

The landing page is served by a lightweight Node.js server from `dist/`. The server also delivers reservation requests to Telegram without exposing the bot token to site visitors.

## Structure

- `dist/index.html` — page markup and SEO metadata
- `dist/assets/css/styles.css` — design tokens, reset, layout, and components
- `dist/assets/js/main.js` — progressive client-side behavior
- `dist/assets/images/` — raster and vector image assets
- `dist/assets/fonts/` — self-hosted web fonts, if used
- `server.mjs` — static server and private Telegram reservation endpoint
- `.env.telegram.local` — local Telegram credentials; ignored by Git

## Run locally

With Node.js installed, run:

```powershell
npm start
```

Then open [http://localhost:3000](http://localhost:3000). A completed reservation form is sent only to the `TELEGRAM_CHAT_ID` in `.env.telegram.local`.

For a public launch, deploy this project to a Node.js-capable host and add the same two values as server-side secrets there. Do not place them in frontend files or a repository.

## Vercel portfolio deployment

The `api/reservations.js` file is the Vercel version of the Telegram form endpoint. In the Vercel project's **Settings → Environment Variables**, create `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from your local file. Mark both for the Production environment, then redeploy. The local `.env.telegram.local` file is excluded from Vercel uploads.
