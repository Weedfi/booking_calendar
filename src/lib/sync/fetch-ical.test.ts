import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FeedFetchError, fetchIcal } from "./fetch-ical";

const SECRET_PATH = "/export/secret-token-abc123.ics";
let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === SECRET_PATH) {
      res.writeHead(200, { "content-type": "text/calendar" });
      res.end("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");
    } else {
      res.writeHead(404, "Not Found");
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("fetchIcal", () => {
  it("returns the feed body", async () => {
    await expect(fetchIcal(base + SECRET_PATH)).resolves.toContain("BEGIN:VCALENDAR");
  });

  it("reports HTTP errors without leaking the URL", async () => {
    const error = await fetchIcal(`${base}/export/other-secret.ics`).catch((e) => e);
    expect(error).toBeInstanceOf(FeedFetchError);
    expect(error.message).toBe("HTTP 404 Not Found");
  });

  it("reports network errors without leaking the URL", async () => {
    // Port 9 (discard) is closed on practically every machine.
    const error = await fetchIcal("http://127.0.0.1:9/export/secret-token.ics").catch((e) => e);
    expect(error).toBeInstanceOf(FeedFetchError);
    expect(error.message).toMatch(/^Błąd sieci/);
    expect(error.message).not.toContain("secret-token");
  });
});
