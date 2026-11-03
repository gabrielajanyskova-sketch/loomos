/**
 * Starts the built site with Cloudflare Pages Functions and a throwaway local D1 database,
 * plus a fake Resend/Packeta endpoint that records outgoing e-mails and packets.
 */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

export async function startShop(extra = {}) {
  const mails = [];
  const packets = [];
  const fake = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    if (req.url.startsWith("/emails")) {
      mails.push({ headers: req.headers, body: JSON.parse(body) });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"id":"test"}');
    } else {
      packets.push(body);
      res.writeHead(200, { "Content-Type": "text/xml" });
      res.end(
        "<response><status>ok</status><result><id>987</id><barcode>Z987</barcode><barcodeText>Z 987</barcodeText></result></response>",
      );
    }
  });
  fake.listen(0, "127.0.0.1");
  await once(fake, "listening");
  const fakeUrl = `http://127.0.0.1:${fake.address().port}`;
  const persist = await mkdtemp(path.join(tmpdir(), "loomos-d1-"));
  const port = 8800 + Math.floor(Math.random() * 900);
  const env = {
    ADMIN_PASSWORD: "test-admin-password-123",
    BANK_ACCOUNT: "19-2000145399/0800",
    RESEND_API_KEY: "re_test",
    ORDER_RATE_LIMIT: "500",
    RESEND_API_URL: `${fakeUrl}/emails`,
    PACKETA_API_PASSWORD: "packeta<&>secret",
    PACKETA_API_URL: `${fakeUrl}/packeta`,
    ...extra,
  };
  const child = spawn(
    path.join(root, "node_modules", ".bin", "wrangler"),
    [
      "pages",
      "dev",
      "dist",
      "--d1",
      "DB",
      "--port",
      String(port),
      "--ip",
      "127.0.0.1",
      "--persist-to",
      persist,
      "--show-interactive-dev-session=false",
      ...Object.entries(env).flatMap(([k, v]) => ["--binding", `${k}=${v}`]),
    ],
    {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "1" },
      // Own process group, so stop() also ends workerd started by wrangler.
      detached: true,
    },
  );
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    if (child.exitCode !== null) throw Error("wrangler skončil:\n" + log);
    try {
      if ((await fetch(url + "/api/products")).ok) break;
    } catch {
      /* not ready yet */
    }
    if (i > 120) throw Error("wrangler se nespustil:\n" + log);
    await new Promise((r) => setTimeout(r, 500));
  }
  return {
    url,
    env,
    mails,
    packets,
    log: () => log,
    async stop() {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* already gone */
      }
      await Promise.race([
        once(child, "exit"),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
      fake.closeAllConnections();
      fake.close();
      child.stdout.destroy();
      child.stderr.destroy();
      await rm(persist, { recursive: true, force: true });
    },
  };
}

/** Minimal cookie-aware JSON client that behaves like a same-origin browser. */
export function client(base) {
  const jar = new Map();
  return async function call(pathname, data, { origin = base } = {}) {
    const headers = { Origin: origin };
    if (jar.size)
      headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    if (data !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(base + pathname, {
      method: data === undefined ? "GET" : "POST",
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const [k, v] = pair.split("=");
      if (/Max-Age=0/.test(cookie)) jar.delete(k);
      else jar.set(k, v);
    }
    const type = response.headers.get("content-type") || "";
    const body = type.includes("json")
      ? await response.json()
      : await response.arrayBuffer();
    return { status: response.status, body, headers: response.headers };
  };
}
