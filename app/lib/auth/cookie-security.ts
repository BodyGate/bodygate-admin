function getRequestHostname(request: Request) {
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const hostHeader = request.headers.get("host")?.trim();
  const rawHost = forwardedHost || hostHeader || new URL(request.url).host;

  try {
    return new URL(`http://${rawHost}`).hostname.toLowerCase();
  } catch {
    return new URL(request.url).hostname.toLowerCase();
  }
}

function isLocalNetworkHostname(hostname: string) {
  if (hostname === "localhost" || hostname === "::1") return true;
  if (hostname.startsWith("127.")) return true;
  if (hostname.startsWith("10.")) return true;
  if (hostname.startsWith("192.168.")) return true;
  if (hostname.startsWith("169.254.")) return true;

  const parts = hostname.split(".").map(Number);

  return (
    parts.length === 4 &&
    parts[0] === 172 &&
    Number.isInteger(parts[1]) &&
    parts[1] >= 16 &&
    parts[1] <= 31
  );
}

export function shouldUseSecureCookie(request: Request) {
  const hostname = getRequestHostname(request);

  // BodyGate viene raggiunto in palestra tramite HTTP su IP privato.
  // Un cookie Secure su questi host viene scartato da Safari/iPad.
  if (isLocalNetworkHostname(hostname)) return false;

  const explicitSetting = process.env.BODYGATE_COOKIE_SECURE
    ?.trim()
    .toLowerCase();

  if (explicitSetting === "true") return true;
  if (explicitSetting === "false") return false;

  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();

  if (forwardedProtocol) {
    return forwardedProtocol === "https";
  }

  return new URL(request.url).protocol === "https:";
}
