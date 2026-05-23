const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { handleResolve, handleBrowse } = require("./lib/proxy");

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

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (reqUrl.pathname === "/api/resolve") {
      return await handleResolve(req, res);
    }

    if (reqUrl.pathname === "/browse") {
      return await handleBrowse(req, res);
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
