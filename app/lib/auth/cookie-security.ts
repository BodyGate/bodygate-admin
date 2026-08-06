export function shouldUseSecureCookie(request: Request) {
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
