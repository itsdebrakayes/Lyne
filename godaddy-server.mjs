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

if (!existsSync(indexFile)) {
  throw new Error(
    "Website build is missing. Run `npm run build` before `npm start`.",
  );
}

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
