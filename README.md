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

## How it works

1. You enter a URL on the home page or browser bar.
2. The app loads `/browse?url=...` in an iframe.
3. The Node server fetches the page, rewrites `href`/`src`/form actions to point back through the proxy, and injects a small script so clicks stay proxied.

## Notes

- Run locally for personal/testing use.
- Some sites block proxies or require login/CORS — those may not work fully.
- Respect website terms of service and your network's policies.

## Project structure

```
├── server.js          # Proxy + API
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── package.json
```
