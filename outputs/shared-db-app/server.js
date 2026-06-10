import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(__dirname, "public");
const dataDir = resolve(__dirname, "data");
const dbPath = join(dataDir, "members.json");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

const statuses = new Set(["lab", "campus", "out"]);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

await ensureDb();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    sendJson(res, 500, { error: "server_error", message: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`Lab status board is running at http://localhost:${port}`);
  console.log(`For LAN use, open http://<this-computer-ip>:${port} from other devices.`);
});

async function ensureDb() {
  await mkdir(dataDir, { recursive: true });
  if (existsSync(dbPath)) return;

  const now = new Date().toISOString();
  await writeDb([
    { id: randomUUID(), name: "山田さん", status: "lab", note: "実験中", updatedAt: now },
    { id: randomUUID(), name: "佐藤さん", status: "campus", note: "図書館", updatedAt: now },
    { id: randomUUID(), name: "鈴木さん", status: "out", note: "出張", updatedAt: now }
  ]);
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/members" && req.method === "GET") {
    sendJson(res, 200, { members: await readDb() });
    return;
  }

  if (url.pathname === "/api/members" && req.method === "POST") {
    const body = await readJsonBody(req);
    const name = cleanText(body.name);
    const status = cleanStatus(body.status);
    const note = cleanText(body.note || "");

    if (!name) {
      sendJson(res, 400, { error: "name_required" });
      return;
    }

    const members = await readDb();
    const member = {
      id: randomUUID(),
      name,
      status,
      note,
      updatedAt: new Date().toISOString()
    };
    members.unshift(member);
    await writeDb(members);
    sendJson(res, 201, { member });
    return;
  }

  const memberMatch = url.pathname.match(/^\/api\/members\/([^/]+)$/);
  if (memberMatch && req.method === "PATCH") {
    const id = memberMatch[1];
    const body = await readJsonBody(req);
    const members = await readDb();
    const member = members.find((item) => item.id === id);

    if (!member) {
      sendJson(res, 404, { error: "member_not_found" });
      return;
    }

    if (body.status !== undefined) member.status = cleanStatus(body.status);
    if (body.note !== undefined) member.note = cleanText(body.note);
    if (body.name !== undefined) member.name = cleanText(body.name);
    member.updatedAt = new Date().toISOString();

    if (!member.name) {
      sendJson(res, 400, { error: "name_required" });
      return;
    }

    await writeDb(members);
    sendJson(res, 200, { member });
    return;
  }

  if (memberMatch && req.method === "DELETE") {
    const id = memberMatch[1];
    const members = await readDb();
    const nextMembers = members.filter((item) => item.id !== id);
    await writeDb(nextMembers);
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "not_found" });
}

async function serveStatic(pathname, res) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(publicDir, `.${decodeURIComponent(requestedPath)}`);

  if (!filePath.startsWith(publicDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  if (!existsSync(filePath)) {
    sendText(res, 404, "Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream"
  });
  createReadStream(filePath).pipe(res);
}

async function readDb() {
  const text = await readFile(dbPath, "utf8");
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : [];
}

async function writeDb(members) {
  await mkdir(dataDir, { recursive: true });
  const tempPath = `${dbPath}.${process.pid}.tmp`;
  await writeFile(tempPath, JSON.stringify(members, null, 2), "utf8");
  await rename(tempPath, dbPath);
}

async function readJsonBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 100_000) throw new Error("Request body is too large");
  }
  return body ? JSON.parse(body) : {};
}

function cleanStatus(status) {
  return statuses.has(status) ? status : "lab";
}

function cleanText(value) {
  return String(value || "").trim().slice(0, 120);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}
