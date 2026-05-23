# CloudBrowse

A **now.gg-style** web proxy: dark cloud-gaming aesthetic, card grid of popular sites, multi-tab browser, and a working backend that rewrites pages so links stay inside the proxy.

## Features

- now.gg-inspired UI (gradient hero, site cards, categories)
- Full URL bar + search on home and in browser view
- Multi-tab browsing with back/forward/reload
- Server-side HTML rewriting so navigation works through the proxy
- Fullscreen browser pane

## Quick start

Requires **Node.js 18+** only (no npm install needed):

```bash
cd c:\Users\diddy\Projects\cloudbrowse-proxy
node server.js
```

Or, if you have npm:

```bash
npm start
```

Open **http://localhost:3000**

## Deploy to Vercel

The proxy **must** run as serverless functions — deploying only the `public/` folder causes `404: NOT_FOUND` on `/browse`.

1. Push the **whole project** (root must include `api/`, `lib/`, `public/`, `vercel.json`).
2. Import the repo in [Vercel](https://vercel.com).
3. Leave **Output Directory** empty (default). Do not set it to `public`.
4. Deploy. Routes:
   - `/` — static UI from `public/`
   - `/api/resolve` — URL resolver
   - `/browse` — proxied pages (rewritten to `/api/browse`)

Or use the CLI from the project root:

```bash
npx vercel --prod
```

## How it works

1. You enter a URL on the home page or browser bar.
2. The app loads `/browse?url=...` in an iframe.
3. The Node server fetches the page, rewrites `href`/`src`/form actions to point back through the proxy, and injects a small script so clicks stay proxied.

## Troubleshooting

| Problem | Cause | Fix |
|--------|--------|-----|
| **Guru Meditation / Goofy Deploy 404** | Host has no `/browse` API | Redeploy full repo; keep Output Directory empty on Vercel |
| **Typing `tiktok` fails** | Was resolving to `https://tiktok` | Fixed — now maps to `www.tiktok.com` (TikTok may still block proxies) |
| **CrazyGames loads forever** | Games need fetch proxy + full page | Auto-opens full page; redeploy latest code |
| **White screen (e.g. base44.app)** | SPA assets bypassed proxy | Redeploy — inject script now proxies `fetch` / XHR |

**Hard limits:** TikTok, Netflix, and some apps block all web proxies. WebSockets (multiplayer games) may not work on serverless hosts.

## Notes

- Run locally for personal/testing use.
- Some sites block proxies or require login/CORS — those may not work fully.
- Respect website terms of service and your network's policies.

## Project structure

```
├── server.js          # Local dev server
├── lib/proxy.js       # Shared proxy logic
├── api/
│   ├── browse.js      # Vercel: /browse
│   └── resolve.js     # Vercel: /api/resolve
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── vercel.json
└── package.json
```
