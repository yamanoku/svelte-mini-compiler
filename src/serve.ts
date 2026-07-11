/**
 * public/ を配信する最小の静的HTTPサーバー。
 * ESモジュールは file:// では読み込めないため、index.html の動作確認に使う。
 *
 *   node src/serve.ts        # http://localhost:3000
 *   PORT=8080 node src/serve.ts
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../public/", import.meta.url));
const port = Number(process.env.PORT ?? 3000);

const content_types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const file_path = normalize(join(root, pathname));

  // public/ の外へのパストラバーサルを拒否する
  if (!file_path.startsWith(root)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(file_path);
    res.writeHead(200, {
      "content-type": content_types[extname(file_path)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  }
});

server.listen(port, () => {
  console.log(`http://localhost:${port} で public/ を配信中`);
});
