# Billing Setup

This backend now supports three billing layers:

- RevenueCat subscription state sync
- Local usage periods and usage events
- Credit-based metering for OpenAI requests

## RevenueCat identity

Use the backend user id as the RevenueCat app user id in this format:

`user_<user_id>`

The auth endpoints now return this value as `user.revenuecat_app_user_id`.

## Required environment variables

- `REVENUECAT_SECRET_API_KEY`: RevenueCat secret REST API key used by the backend sync endpoint and webhook processor
- `REVENUECAT_WEBHOOK_AUTH`: Optional shared secret header value to verify RevenueCat webhooks

## Frontend RevenueCat environment variables

- `REACT_APP_REVENUECAT_WEB_PUBLIC_API_KEY`: RevenueCat Web Billing public API key for production checkout
- `REACT_APP_REVENUECAT_WEB_SANDBOX_API_KEY`: Optional sandbox web key used automatically outside production when present
- `REACT_APP_REVENUECAT_PLAN_OFFERING_MAP_JSON`: Optional JSON map from app plan codes to RevenueCat offering ids
- `REACT_APP_REVENUECAT_CURRENCY`: Optional currency override passed to the RevenueCat web SDK when loading offerings

Example:

```json
{
  "go": "go",
  "plus": "plus"
}
```

## Optional billing environment variables

- `BILLING_PLAN_CATALOG_JSON`: JSON object defining plans, entitlements, and monthly credits
- `BILLING_TEXT_TOKENS_PER_CREDIT`: Default `500`
- `BILLING_TTS_CHARACTERS_PER_CREDIT`: Default `5`
- `BILLING_TRANSCRIPTION_SECONDS_PER_CREDIT`: Default `1`
- `BILLING_DEFAULT_TRANSCRIPTION_SECONDS_ESTIMATE`: Default `1`

Example:

```json
{
  "free": {
    "display_name": "Free",
    "monthly_credits": 250,
    "entitlements": []
  },
  "go": {
    "display_name": "Go",
    "monthly_credits": 5000,
    "entitlements": ["go"]
  },
  "plus": {
    "display_name": "Plus",
    "monthly_credits": 20000,
    "entitlements": ["plus"]
  }
}
```

## Endpoints

- `GET /api/billing/plans`: Public plan catalog for paywall UI
- `GET /api/billing/me`: Authenticated billing status for current user
- `POST /api/billing/revenuecat/sync`: Authenticated pull sync from RevenueCat
- `POST /api/billing/revenuecat/webhook`: RevenueCat webhook receiver

## Metering behavior

- `gpt-4o-mini`: billed from actual `usage.total_tokens`
- `tts-1`: billed from actual input character count
- `whisper-1`: billed from transcription duration when available

`/analyze-audio` records up to three usage events:

- `transcription`
- `instruction_extract`
- `tts_batch`

`/process-live-text` records one usage event:

- `tts_batch`

`/filter-live-chunk` records one usage event:

- `instruction_filter`

## RevenueCat dashboard mapping

Recommended entitlement identifiers:

- `go`
- `plus`

Recommended flow:

1. Configure products in RevenueCat.
2. Attach products to the matching entitlements.
3. Present offerings in the client.
4. Log the user into RevenueCat with `user.revenuecat_app_user_id`.
5. Call `POST /api/billing/revenuecat/sync` after purchase or restore.
6. Register the webhook URL and set the authorization header.

## Web checkout flow

The frontend settings page now expects this RevenueCat setup:

1. Create offerings for the paid plans (`go`, `plus`) or provide a custom offering map.
2. Add at least one purchasable package to each offering, such as monthly or annual.
3. Expose the web public API key to the React app.
4. Sign the user in before checkout so the web SDK can use `user.revenuecat_app_user_id`.
5. After checkout completes, call `POST /api/billing/revenuecat/sync` so backend credits reflect the new entitlement.

## Current integration note

The audio endpoints still allow anonymous access for backward compatibility. Credit enforcement only applies when the request includes a valid bearer token. For production billing, move the billable routes to required auth once the paywall and sign-in flow are fully wired.