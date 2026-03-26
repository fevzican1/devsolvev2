# Google Indexing API on Netlify

This project includes a secured Netlify Function endpoint at `/api/google-indexing` to submit URL update or delete notifications to Google's Indexing API.

## Important limitation

Google's Indexing API is officially intended for limited content types (for example, `JobPosting` and `BroadcastEvent` pages). For standard content pages, Google may ignore notifications.

For broader indexing acceleration, keep XML sitemaps fresh, ensure internal linking is strong, and submit key pages through Search Console.

## Required environment variables

Set the following variables in Netlify:

- `INDEXING_API_SHARED_KEY`: Shared secret required in request header `x-indexing-key`.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Service account client email.
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: Service account private key. Keep PEM format; escaped newlines (`\\n`) are supported.
- `SITE_URL`: Canonical site URL (for example `https://devsolvev2.com`).

## Endpoint contract

- Method: `POST`
- Path: `/api/google-indexing`
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
curl -X POST "https://devsolvev2.com/api/google-indexing" \
  -H "Content-Type: application/json" \
  -H "x-indexing-key: YOUR_SHARED_KEY" \
  -d '{"url":"https://devsolvev2.com/guides/json-validation-formatting/","type":"URL_UPDATED"}'
```
