# Email trigger worker

Turns Booking.com notification emails into an instant sync.

```
Booking.com ──email──▶ manager's mailbox ──auto-forward──▶ sync@your-domain
                                                              │ Cloudflare Email Routing
                                                              ▼
                                   this worker ──POST──▶ /api/sync-trigger ──▶ iCal sync
```

## Setup

1. Add your domain to Cloudflare and enable **Email Routing** (free).
2. Deploy the worker:
   ```bash
   cd workers/email-trigger
   npm install
   npx wrangler secret put SYNC_TRIGGER_SECRET   # same value as in the app
   # edit SYNC_TRIGGER_URL in wrangler.toml, then:
   npm run deploy
   ```
3. In Email Routing, create a custom address such as `sync@your-domain` with the
   action **Send to a Worker** → `rental-calendar-email-trigger`.
4. In the manager's mailbox, auto-forward emails from `booking.com` to that
   address (Gmail: Settings → Forwarding, then a filter `from:booking.com`).

## What is sent

Only `from`, `subject`, `received_at` and the plain-text body. The app uses
them to find which property changed, then syncs its iCal feed. It never
stores the email; `sync_events` only records when it arrived, how the
property was matched and whether the sync worked.
