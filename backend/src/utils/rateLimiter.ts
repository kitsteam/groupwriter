import { IncomingMessage, ServerResponse } from "http";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 30;

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, DEFAULT_WINDOW_MS);
cleanupInterval.unref();

const getClientIp = (request: IncomingMessage): string => {
  // Use rightmost X-Forwarded-For entry (set by the closest trusted proxy)
  // rather than leftmost (client-controlled and spoofable)
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    const parts = forwarded.split(",").map((s) => s.trim());
    return parts[parts.length - 1];
  }
  return request.socket.remoteAddress ?? "unknown";
};

export const checkRateLimit = (
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
  maxRequests: number = DEFAULT_MAX_REQUESTS,
  windowMs: number = DEFAULT_WINDOW_MS,
): boolean => {
  const ip = getClientIp(request);
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    response.writeHead(429, {
      "Content-Type": "text/json",
      "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
    });
    response.end(JSON.stringify({ error: "Too many requests" }));
    return false;
  }

  store.set(ip, { ...entry, count: entry.count + 1 });
  return true;
};
