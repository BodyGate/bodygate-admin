// Manifest PWA per-pass. Il manifest globale (public/manifest.json) non può
// contenere un token: chi salvava il pass nella Home apriva sempre lo stesso
// indirizzo, non il proprio. Ogni pass pubblica il proprio manifest, con
// start_url = la pagina del pass di quel cliente.

// I token pubblici sono base64url / lettere, cifre, "-" e "_".
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export type PassKind = "mobile" | "staff-mobile";

export function isValidPassToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export function passPath(kind: PassKind, token: string): string {
  return `/${kind}/${token}`;
}

export function passManifestPath(kind: PassKind, token: string): string {
  return `${passPath(kind, token)}/manifest.webmanifest`;
}

export function buildPassManifest(kind: PassKind, token: string) {
  const startUrl = passPath(kind, token);

  return {
    name: kind === "staff-mobile" ? "BodyGate Staff Pass" : "BodyGate Mobile Pass",
    short_name: "BodyGate",
    description: "Pass BodyGate per accesso palestra con QR Code.",
    id: startUrl,
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050505",
    theme_color: "#050505",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

export function passManifestResponse(kind: PassKind, token: string): Response {
  if (!isValidPassToken(token)) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(JSON.stringify(buildPassManifest(kind, token)), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// --- Recupero delle icone già salvate in Home -------------------------------
// Le icone installate prima di questa correzione riaprono per sempre il vecchio
// start_url fisso: non sappiamo chi le ha. Ogni pass aperto ricorda nel browser
// (cookie + localStorage) il proprio indirizzo; /mobile/open lo ritrova e ci
// rimanda, senza che il cliente debba rifare nulla.

export const LEGACY_PASS_TOKEN = "BGM_0VNB-UKBYB6-PB4F";
export const REMEMBERED_PASS_KEY = "bg_pass";
export const OPEN_PASS_PATH = "/mobile/open";

const REMEMBERED_PATH_PATTERN = /^\/(mobile|staff-mobile)\/[A-Za-z0-9_-]{8,128}$/;

// Restituisce il path del pass ricordato solo se ha esattamente la forma attesa
// (mai un indirizzo arbitrario: niente open redirect). "open" non è un token.
export function rememberedPassPath(value: string | null | undefined): string | null {
  if (!value) return null;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }

  if (!REMEMBERED_PATH_PATTERN.test(decoded)) return null;
  if (decoded === OPEN_PASS_PATH) return null;

  return decoded;
}
