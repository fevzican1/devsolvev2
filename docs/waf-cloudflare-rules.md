# Cloudflare WAF — paste-ready (Free plan, 5 custom rules)

First match wins. Bot Fight Mode stays **OFF**. Do **not** purge cache to
stop this farm — a purge only forces Function reruns and costs money. WAF
is what stops them.

## WAF1 — Skip

Action: Skip (current ruleset + WAF, rate limit, security level, BIC, UA block, hotspot, lockdown)

```
(lower(http.user_agent) contains "google" or lower(http.user_agent) contains "bing" or lower(http.user_agent) contains "msn" or lower(http.user_agent) contains "adidx" or lower(http.user_agent) contains "microsoftpreview" or lower(http.user_agent) contains "twitter" or lower(http.user_agent) contains "facebook" or lower(http.user_agent) contains "facebot" or lower(http.user_agent) contains "linkedin" or lower(http.user_agent) contains "slack" or lower(http.user_agent) contains "discord" or lower(http.user_agent) contains "whatsapp" or lower(http.user_agent) contains "telegram" or lower(http.user_agent) contains "reddit" or lower(http.user_agent) contains "pinterest" or lower(http.user_agent) contains "applebot" or http.request.uri.path in {"/robots.txt" "/sitemap.xml" "/feed.xml" "/opengraph-image.png" "/ee5098cac2284d92b6ee1c9fca52a120.txt" "/ads.txt" "/sellers.json"})
```

No `cf.client.bot`. Search crawlers are named only here.

## WAF2 — Block

The farm stamps `Chrome/144.0.0.0` / `Edg/144.0.0.0`. A real browser is `Chrome/144.0.7559.109`.

```
(lower(http.user_agent) contains "gpt" or lower(http.user_agent) contains "oai-" or lower(http.user_agent) contains "claude" or lower(http.user_agent) contains "anthropic" or lower(http.user_agent) contains "perplexity" or lower(http.user_agent) contains "bytespider" or lower(http.user_agent) contains "ccbot" or lower(http.user_agent) contains "ahrefs" or lower(http.user_agent) contains "semrush" or lower(http.user_agent) contains "dataforseo" or lower(http.user_agent) contains "headless" or lower(http.user_agent) contains "puppeteer" or lower(http.user_agent) contains "selenium" or lower(http.user_agent) contains "curl" or lower(http.user_agent) contains "wget" or lower(http.user_agent) contains "python" or lower(http.user_agent) contains "scrapy" or lower(http.user_agent) contains "chrome-extension" or lower(http.user_agent) contains "moz-extension" or http.request.headers["origin"][0] contains "chrome-extension" or http.request.headers["referer"][0] contains "chrome-extension" or http.request.headers["origin"][0] contains "moz-extension" or http.request.headers["referer"][0] contains "moz-extension" or lower(http.user_agent) contains ".0.0.0" or lower(http.user_agent) contains "chrome/100.0.4896" or (lower(http.user_agent) contains "mac os x 10_15_7" and lower(http.user_agent) contains "chrome/") or (len(http.user_agent) lt 12 and not cf.client.bot))
```

## WAF3 — Block

Chrome on `/k/` that is not a real page open (navigate + document). Empty fetch headers now match — that was the previous hole.

```
(starts_with(http.request.uri.path, "/k/") and lower(http.user_agent) contains "chrome/" and not (http.request.headers["sec-fetch-mode"][0] eq "navigate" and http.request.headers["sec-fetch-dest"][0] eq "document"))
```

## WAF4 — Block (operator `sasd`)

Leave the existing wp-admin / `.env` rule as it is.

## WAF5 — Block (AI Crawl Control)

Leave the existing AI Crawl Control rule as it is.

## Rate limit (separate screen)

`/k/*` and `/sitemap*`, 30 requests / 10 seconds / IP, `not cf.client.bot`. WAF1 already skips the rate-limit product for search and social User-Agents.
