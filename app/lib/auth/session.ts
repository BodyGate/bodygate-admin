export const SESSION_COOKIE_NAME = "bodygate_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

export type SessionClaims = {
  userId: string;
  role: string;
  issuedAt: number;
  expiresAt: number;
  version: 1;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function getSessionSecret() {
  const secret =
    process.env.BODYGATE_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!secret || secret.length < 32) {
    throw new Error(
      "BODYGATE_SESSION_SECRET mancante o troppo corto. Configurare almeno 32 caratteri."
    );
  }

  return secret;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4;
  const padded = padding === 0 ? base64 : `${base64}${"=".repeat(4 - padding)}`;
  const binary = atob(padded);

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(
  userId: string,
  role: string,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS
) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const claims: SessionClaims = {
    userId,
    role,
    issuedAt,
    expiresAt: issuedAt + maxAgeSeconds,
    version: 1,
  };

  const payload = bytesToBase64Url(
    textEncoder.encode(JSON.stringify(claims))
  );
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(payload)
  );

  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
  token?: string | null
): Promise<SessionClaims | null> {
  if (!token) return null;

  try {
    const parts = token.split(".");

    if (parts.length !== 2) return null;

    const [payload, signature] = parts;
    const key = await getSigningKey();
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signature),
      textEncoder.encode(payload)
    );

    if (!validSignature) return null;

    const claims = JSON.parse(
      textDecoder.decode(base64UrlToBytes(payload))
    ) as Partial<SessionClaims>;
    const now = Math.floor(Date.now() / 1000);

    if (
      claims.version !== 1 ||
      typeof claims.userId !== "string" ||
      !claims.userId ||
      typeof claims.role !== "string" ||
      typeof claims.issuedAt !== "number" ||
      typeof claims.expiresAt !== "number" ||
      claims.issuedAt > now + 60 ||
      claims.expiresAt <= now ||
      claims.expiresAt <= claims.issuedAt
    ) {
      return null;
    }

    return claims as SessionClaims;
  } catch {
    return null;
  }
}
