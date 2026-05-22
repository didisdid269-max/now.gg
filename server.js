const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function normalizeUrl(input) {
  let url = (input || "").trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function proxyBase(req) {
  const host = req.headers.host || `localhost:${PORT}`;
  return `http://${host}`;
}

function toProxyUrl(req, targetUrl) {
  return `${proxyBase(req)}/browse?url=${encodeURIComponent(targetUrl)}`;
}

function rewriteUrl(req, value, pageUrl) {
  if (!value || typeof value !== "string") return value;
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("mailto:")
  ) {
    return value;
  }
  try {
    return toProxyUrl(req, new URL(trimmed, pageUrl).href);
  } catch {
    return value;
  }
}

const INJECT_SCRIPT = (proxyOrigin) => `
<script>
(function(){
  const PROXY = "${proxyOrigin}/browse?url=";
  const open = window.open;
  window.open = function(u,n,f){
    if(u && !u.startsWith(PROXY) && !u.startsWith("javascript:")){
      try { return open(PROXY + encodeURIComponent(new URL(u, document.baseURI).href), n, f); }
      catch(e){ return open(u,n,f); }
    }
    return open(u,n,f);
  };
  document.addEventListener("click", function(e){
    const a = e.target.closest("a");
    if(!a || !a.href) return;
    if(a.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if(a.href.indexOf(PROXY) === 0) return;
    e.preventDefault();
    location.href = PROXY + encodeURIComponent(a.href);
  }, true);
})();
</script>`;

function rewriteHtml(html, req, pageUrl) {
  const proxyOrigin = proxyBase(req);
  let out = html;

  out = out.replace(
    /(\s(?:href|src|action)\s*=\s*["'])([^"']+)(["'])/gi,
    (match, pre, val, post) => {
      const rewritten = rewriteUrl(req, val, pageUrl);
      return pre + rewritten + post;
    }
  );

  out = out.replace(
    /<meta\s+http-equiv=["']refresh["']\s+content=["']([^"']+)["']/gi,
    (match, content) => {
      const m = content.match(/^\s*(\d+)\s*;\s*url\s*=\s*(.+)$/i);
      if (!m) return match;
      return `<meta http-equiv="refresh" content="${m[1]}; url=${rewriteUrl(req, m[2].trim(), pageUrl)}"`;
    }
  );

  const baseTag = `<base href="${pageUrl}">`;
  const script = INJECT_SCRIPT(proxyOrigin);

  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (h) => h + baseTag + script);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (h) => h + "<head>" + baseTag + script + "</head>");
  } else {
    out = baseTag + script + out;
  }

  return out;
}

function fetchUrl(url, reqHeaders, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 8) return reject(new Error("Too many redirects"));
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return reject(e);
    }

    const lib = parsed.protocol === "https:" ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        "User-Agent":
          reqHeaders["user-agent"] ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          reqHeaders["accept"] ||
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": reqHeaders["accept-language"] || "en-US,en;q=0.9",
      },
    };

    const request = lib.request(options, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = new URL(res.headers.location, url).href;
        res.resume();
        return fetchUrl(next, reqHeaders, redirects + 1).then(resolve).catch(reject);
      }

      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });

    request.on("error", reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error("Request timeout"));
    });
    request.end();
  });
}

function serveStatic(filePath, res) {
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function parseQuery(search) {
  const params = {};
  if (!search) return params;
  const q = search.startsWith("?") ? search.slice(1) : search;
  for (const part of q.split("&")) {
    const [k, v] = part.split("=").map(decodeURIComponent);
    if (k) params[k] = v || "";
  }
  return params;
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (reqUrl.pathname === "/api/resolve") {
      const target = normalizeUrl(parseQuery(reqUrl.search).url);
      if (!target) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid URL" }));
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ url: target, proxyUrl: toProxyUrl(req, target) }));
    }

    if (reqUrl.pathname === "/browse") {
      const target = normalizeUrl(parseQuery(reqUrl.search).url);
      if (!target) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        return res.end("Invalid URL. Use ?url=https://example.com");
      }

      const upstream = await fetchUrl(target, req.headers);
      const contentType = upstream.headers["content-type"] || "";

      if (contentType.includes("text/html")) {
        const html = upstream.body.toString("utf8");
        const rewritten = rewriteHtml(html, req, target);
        res.writeHead(upstream.status, {
          "Content-Type": "text/html; charset=utf-8",
          "X-Proxy-Target": target,
        });
        return res.end(rewritten);
      }

      const headers = { "X-Proxy-Target": target };
      if (contentType) headers["Content-Type"] = contentType;
      if (upstream.headers["content-length"]) {
        headers["Content-Length"] = upstream.body.length;
      }
      res.writeHead(upstream.status, headers);
      return res.end(upstream.body);
    }

    let filePath = path.join(PUBLIC, reqUrl.pathname === "/" ? "index.html" : reqUrl.pathname);
    if (!filePath.startsWith(PUBLIC)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return serveStatic(filePath, res);
    }
    return serveStatic(path.join(PUBLIC, "index.html"), res);
  } catch (err) {
    console.error("Error:", err.message);
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`Proxy error: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`CloudBrowse running at http://localhost:${PORT}`);
});
