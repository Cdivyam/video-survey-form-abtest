const SESSION_MS = 12 * 60 * 60 * 1000;
const ALGO = { name: "HMAC", hash: "SHA-256" };
const enc = new TextEncoder();

function sessionSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-secret-change-before-production";
}

async function sign(data: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw", enc.encode(sessionSecret()), ALGO, false, ["sign"]
  );
  const buf = await globalThis.crypto.subtle.sign(ALGO, key, enc.encode(data));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(): Promise<string> {
  const ts = Date.now();
  return `${ts}|${await sign(String(ts))}`;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  const [ts, sig] = token.split("|");
  const timestamp = parseInt(ts, 10);
  if (!ts || !sig || isNaN(timestamp)) return false;
  if (Date.now() - timestamp > SESSION_MS) return false;
  const expected = await sign(ts);
  if (expected.length !== sig.length) return false;
  const a = enc.encode(expected);
  const b = enc.encode(sig);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
