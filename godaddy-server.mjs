import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const distDirectory = resolve(
  fileURLToPath(new URL("./apps/website/dist/", import.meta.url)),
);
const indexFile = resolve(distDirectory, "index.html");
const port = Number.parseInt(process.env.PORT || "3000", 10);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

/* Do NOT throw here.
 *
 * A process that exits on boot is, from the outside, indistinguishable from a
 * blank page: the platform reports the deploy succeeded, the browser gets
 * nothing, and the reason is in a log nobody is reading. That is exactly how
 * this failed the first time.
 *
 * apps/website/dist is gitignored, so a fresh clone has no build. A Node PaaS
 * runs `npm install` and then `npm start` — it does not run `npm run build`
 * unless told to, which is why package.json now builds on postinstall. If that
 * still has not happened, the server starts anyway and SAYS SO, in the
 * browser, rather than dying silently. */
const buildMissing = !existsSync(indexFile);

if (buildMissing) {
  console.error(
    "[lyne] apps/website/dist/index.html is missing — the site was never built.",
  );
}

const BUILD_MISSING_PAGE = `<!doctype html>
<html lang="en" style="background:#060d1c;color:#e6ecf5">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lyne — not built yet</title></head>
<body style="font:14px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">
<div style="max-width:620px;margin:12vh auto;padding:0 24px">
  <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.55">Lyne</div>
  <h1 style="font-size:24px;margin:14px 0 10px">The site has not been built.</h1>
  <p style="opacity:.8">The server is running, but <code>apps/website/dist/index.html</code> does not exist,
  so there is nothing to serve.</p>
  <p style="opacity:.8"><code>dist</code> is not committed to the repository — the host has to build it.
  Run <code>npm run build</code> as part of the deploy, or make sure the
  <code>postinstall</code> step is allowed to run.</p>
</div></body></html>`;

function sendFile(request, response, filePath) {
  const extension = extname(filePath).toLowerCase();
  const isAsset = filePath.startsWith(resolve(distDirectory, "assets") + sep);

  response.writeHead(200, {
    "Cache-Control": isAsset
      ? "public, max-age=31536000, immutable"
      : "no-cache",
    "Content-Type": contentTypes.get(extension) || "application/octet-stream",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}

const server = createServer((request, response) => {
  if (buildMissing) {
    response.writeHead(503, {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(request.method === "HEAD" ? undefined : BUILD_MISSING_PAGE);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method Not Allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url || "/", "http://localhost").pathname,
    );
  } catch {
    response.writeHead(400);
    response.end("Bad Request");
    return;
  }

  const requestedFile = resolve(distDirectory, `.${pathname}`);
  const insideDist =
    requestedFile === distDirectory || requestedFile.startsWith(distDirectory + sep);

  if (!insideDist) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (existsSync(requestedFile) && statSync(requestedFile).isFile()) {
    sendFile(request, response, requestedFile);
    return;
  }

  if (extname(pathname)) {
    response.writeHead(404);
    response.end("Not Found");
    return;
  }

  // React Router owns application routes, so unknown extensionless paths
  // receive the app shell and are resolved client-side.
  sendFile(request, response, indexFile);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Lyne website listening on 0.0.0.0:${port}`);
});
