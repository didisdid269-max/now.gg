const { handleBrowse } = require("../lib/proxy");

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }
  try {
    await handleBrowse(req, res);
  } catch (err) {
    console.error("Browse error:", err.message);
    res.statusCode = 502;
    res.setHeader("Content-Type", "text/plain");
    res.end(`Proxy error: ${err.message}`);
  }
};
