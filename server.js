// Tandem LaTeX compile service. POST /compile with JSON:
// { engine: "pdflatex"|"xelatex"|"lualatex", main: "main.tex", files: [{ path, encoding: "utf8"|"base64", content }] }
// Returns application/pdf on success, or text/plain log on failure.
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const { execFile } = require("child_process");
const TOKEN = process.env.COMPILER_TOKEN;
const ENGINES = { pdflatex: "-pdf", xelatex: "-xelatex", lualatex: "-lualatex" };

http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") return res.end("ok");
  if (req.method !== "POST" || req.url !== "/compile") { res.writeHead(404); return res.end(); }
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401); return res.end("Unauthorized"); }
  let body = "";
  req.on("data", (c) => { body += c; if (body.length > 60e6) req.destroy(); });
  req.on("end", () => {
    let job;
    try { job = JSON.parse(body); } catch { res.writeHead(400); return res.end("Bad JSON"); }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tex-"));
    try {
      for (const f of job.files || []) {
        const p = path.resolve(dir, f.path);
        if (!p.startsWith(dir + path.sep)) throw new Error("Bad path " + f.path);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, Buffer.from(f.content, f.encoding === "base64" ? "base64" : "utf8"));
      }
    } catch (e) { res.writeHead(400); return res.end(String(e.message)); }
    const main = job.main || "main.tex";
    const flag = ENGINES[job.engine] || "-pdf";
    execFile("latexmk", [flag, "-interaction=nonstopmode", "-halt-on-error", "-file-line-error", "-no-shell-escape", main],
      { cwd: dir, timeout: 120000, maxBuffer: 20e6 }, (err, stdout, stderr) => {
        const pdf = path.join(dir, main.replace(/\.tex$/, ".pdf"));
        if (!err && fs.existsSync(pdf)) {
          res.writeHead(200, { "content-type": "application/pdf" });
          res.end(fs.readFileSync(pdf));
        } else {
          res.writeHead(422, { "content-type": "text/plain; charset=utf-8" });
          res.end((stdout + "\n" + stderr).slice(-20000));
        }
        fs.rm(dir, { recursive: true, force: true }, () => {});
      });
  });
}).listen(process.env.PORT || 8080, () => console.log("LaTeX compiler ready"));
