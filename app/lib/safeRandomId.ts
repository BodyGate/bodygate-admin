export function safeRandomId(prefix = "id") {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return `${prefix}-${cryptoObj.randomUUID()}`;
  }

  const perf = typeof performance !== "undefined" ? Math.floor(performance.now()) : 0;

  return `${prefix}-${Date.now()}-${perf}-${Math.random().toString(36).slice(2, 10)}`;
}
