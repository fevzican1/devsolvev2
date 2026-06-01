# Google Indexing API on Netlify

This project exposes two secured Next.js API routes for Google Indexing submissions:

- `POST /api/indexing/google` for direct URL notifications
- `POST /api/indexing/google/webhook` for automated create/update/delete webhook events

The existing Netlify Function endpoint at `/api/google-indexing` remains available for backward compatibility.

## Important limitation

Google's Indexing API is officially intended for limited content types (for example, `JobPosting` and `BroadcastEvent` pages). For standard content pages, Google may ignore notifications.

For broader indexing acceleration, keep XML sitemaps fresh, ensure internal linking is strong, and submit key pages through Search Console.

## Required environment variables

Set the following variables in Netlify:

- `INDEXING_API_SHARED_KEY`: Shared secret required in request header `x-indexing-key`.
- `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON`: Full Google service-account JSON string (recommended).
- Optional fallback: `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON_BASE64` (base64-encoded service-account JSON).
- Legacy fallback: `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.
- `SITE_URL`: Canonical site URL (for example `https://devsolvev2.com`).

## Endpoint contract

- Method: `POST`
- Path: `/api/indexing/google`
- Headers:
  - `Content-Type: application/json`
  - `x-indexing-key: <INDEXING_API_SHARED_KEY>`
- Body:

```json
{
  "url": "https://devsolvev2.com/guides/json-validation-formatting/",
  "type": "URL_UPDATED"
}
```

`type` can be `URL_UPDATED` or `URL_DELETED`.

## Security and validation

- Only `https` URLs are accepted.
- Only URLs under this project's canonical host are accepted.
- Requests without the shared key are rejected.

## Example request

```bash
curl -X POST "https://devsolvev2.com/api/indexing/google" \
  -H "Content-Type: application/json" \
  -H "x-indexing-key: YOUR_SHARED_KEY" \
  -d '{"url":"https://devsolvev2.com/guides/json-validation-formatting/","type":"URL_UPDATED"}'
```

## Webhook contract (automatic notifications)

- Method: `POST`
- Path: `/api/indexing/google/webhook`
- Headers:
  - `Content-Type: application/json`
  - `x-indexing-key: <INDEXING_API_SHARED_KEY>`
- Body:

```json
{
  "event": "updated",
  "path": "/k/json-validate-json-backend-engineer-debug-production-issue-json-formatter-0"
}
```

`event` values:
- `created` -> `URL_UPDATED`
- `updated` -> `URL_UPDATED`
- `deleted` -> `URL_DELETED`

`path` can be replaced by absolute `url` if preferred.

## Hub discovery bridge automation

The project also includes an automated hub-link rotation flow that updates internal links on hub pages and pings Google for those hub URLs:

- `GET/POST /api/hub-discovery-rotate`
  - Refreshes dynamic link sets for hub pages (`/`, `/guides/`, `/tools/`, `/about/`, `/contact/` by default).
  - Sends `URL_UPDATED` notification for each refreshed hub URL when credentials are configured.
  - Scheduled hourly via Netlify Functions schedule.
  - Manual trigger header: `x-hub-rotation-key: <HUB_DISCOVERY_ROTATION_KEY>` (falls back to `INDEXING_API_SHARED_KEY`).

- `POST /api/hub-discovery-priority-sync`
  - Accepts Search Console discovered URL batches and stores them in Netlify Blobs so rotation prioritizes these URLs first.
  - Header: `x-hub-priority-key: <HUB_DISCOVERY_PRIORITY_KEY>` (falls back to `INDEXING_API_SHARED_KEY`).
  - Body:

```json
{
  "mode": "replace",
  "chunkSize": 5000,
  "urls": [
    "https://devsolvev2.com/k/example-page-1/",
    "https://devsolvev2.com/k/example-page-2/"
  ]
}
```
