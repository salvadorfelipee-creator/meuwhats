// Servidor estático local do site da Especitá (URLs sem .html, como na Vercel).
// Uso:  node serve.cjs            -> http://localhost:4174
//       node serve.cjs 8080       -> outra porta
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = __dirname, PORT = parseInt(process.argv[2], 10) || 4174;
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".json": "application/json" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
  let f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Página não encontrada"); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-cache" });
  res.end(fs.readFileSync(f));
}).listen(PORT, () => console.log("Site da Especitá em http://localhost:" + PORT));
