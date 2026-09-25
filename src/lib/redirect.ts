import type { NextRequest } from "next/server";

/**
 * Absolute URL on the host the browser actually used. `request.url` can
 * report a different host in development (localhost vs 127.0.0.1), which
 * would drop the session cookie that was just set for the original host.
 */
export function sameOriginUrl(request: NextRequest, path: string): URL {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return new URL(path, host ? `${proto}://${host}` : request.url);
}
