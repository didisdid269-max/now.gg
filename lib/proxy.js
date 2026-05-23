const http = require("http");
const https = require("https");
const { URL } = require("url");

function normalizeUrl(input) {
  let url = (input || "").trim();
  if (!url) return null;

  const proxyMatch = url.match(/\/browse\?url=([^&]+)/i);
  if (proxyMatch) {
    try {
      url = decodeURIComponent(proxyMatch[1]);
    } catch {
      /* keep original */
    }
  }

  if (!/^https?:\/\//i.test(url)) {
    if (/\s/.test(url)) {
      return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }
    url = "https://" + url;
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function getProxyBase(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
  const proto =
    req.headers["x-forwarded-proto"] ||
    (String(host).includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function toProxyUrl(req, targetUrl) {
  return `${getProxyBase(req)}/browse?url=${encodeURIComponent(targetUrl)}`;
}

function getUrlParam(req) {
  if (req.query?.url) {
    const q = req.query.url;
    return Array.isArray(q) ? q[0] : q;
  }
  const search = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  if (!search) return null;
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("url");
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
  const proxyOrigin = getProxyBase(req);
  let out = html;

  out = out.replace(
    /(\s(?:href|src|action)\s*=\s*["'])([^"']+)(["'])/gi,
    (_match, pre, val, post) => pre + rewriteUrl(req, val, pageUrl) + post
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
    request.setTimeout(25000, () => {
      request.destroy();
      reject(new Error("Request timeout"));
    });
    request.end();
  });
}

async function handleResolve(req, res) {
  const target = normalizeUrl(getUrlParam(req));
  if (!target) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid URL" }));
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ url: target, proxyUrl: toProxyUrl(req, target) }));
}

async function handleBrowse(req, res) {
  const target = normalizeUrl(getUrlParam(req));
  if (!target) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain");
    res.end("Invalid URL. Use ?url=https://example.com");
    return;
  }

  const upstream = await fetchUrl(target, req.headers);
  const contentType = upstream.headers["content-type"] || "";

  if (contentType.includes("text/html")) {
    const html = upstream.body.toString("utf8");
    const rewritten = rewriteHtml(html, req, target);
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Proxy-Target", target);
    res.end(rewritten);
    return;
  }

  res.statusCode = upstream.status;
  res.setHeader("X-Proxy-Target", target);
  if (contentType) res.setHeader("Content-Type", contentType);
  res.end(upstream.body);
}

module.exports = {
  normalizeUrl,
  getProxyBase,
  toProxyUrl,
  getUrlParam,
  handleResolve,
  handleBrowse,
  fetchUrl,
};
