import { generateDemoFeed, isDemoUrl } from "./demo-feed";

export type FetchIcal = (url: string) => Promise<string>;

export class FeedFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedFetchError";
  }
}

const TIMEOUT_MS = 15_000;

/**
 * Downloads an iCal feed. Error messages never contain the URL, because they
 * are stored in channels.last_sync_error and iCal URLs are secrets.
 */
export const fetchIcal: FetchIcal = async (url) => {
  if (isDemoUrl(url)) {
    // Seed data points at generated feeds; only served when explicitly enabled.
    if (process.env.DEMO_FEEDS !== "true") throw new FeedFetchError("Demo feeds are disabled");
    return generateDemoFeed(url);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { accept: "text/calendar, text/plain;q=0.9, */*;q=0.1" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new FeedFetchError(`Timed out after ${TIMEOUT_MS / 1000} s`);
    }
    const code = (error as { cause?: { code?: string } }).cause?.code;
    throw new FeedFetchError(code ? `Network error (${code})` : "Network error");
  }

  if (!response.ok) {
    throw new FeedFetchError(`HTTP ${response.status} ${response.statusText}`.trim());
  }
  return response.text();
};
