# Review Notes

These notes are for store reviewers and the people preparing the submission.

## Review account rules

- Reviewers may use their own eligible accounts. If the store requires a reproducible paid-plan path, provide dedicated temporary test-account details only through the store's private reviewer-credential field.
- The extension never asks for passwords, recovery codes, or payment information.
- Never put credentials in the ZIP, listing copy, screenshots, or this document.
- Reviewers sign in on each provider's own page. The extension never receives a raw password.
- Available meters vary by provider, account plan, region, and current server response.
- The store copy should disclose the monetization status clearly in both locales: `완전 무료 · 광고 없음 · 구독 없음` / `Completely free · No ads · No subscription`.

## Test sequence

1. Install the extension from the review or test channel.
2. Open the supported AI service pages while signed in.
3. On Claude, confirm the toolbar badge shows the highest available Claude usage percentage.
4. Open the popup and confirm the usage cards load.
5. Confirm the in-page overlay appears on the supported sites.
6. Sign out of one service and confirm the extension shows the login-needed state instead of asking for credentials.
7. Confirm network requests go only to the four declared provider domains and that no developer-hosted backend is involved.
8. If the dashboard asks for localized collateral, use the Korean and English copy from `STORE_LISTING.md` and the matching `lang=ko` / `lang=en` screenshot exports from `SCREENSHOT_PLAN.md`.

## What reviewers should see

- Clear usage values from the signed-in service.
- Local caching behavior in the browser profile.
- Local notifications when a threshold, exhaustion, or reset event occurs. These events may be impractical to force during a short review.
- No request for user passwords, API keys, or payment data.
- A truthful free/no-ads/no-subscription disclosure in the listing copy.
- A popup and page overlay that follow the browser's light/dark theme automatically.

## Submission note

If the reviewer needs a live reproduction path, provide the exact service URL, required account plan, and expected card or meter. Put any dedicated test credentials only in the store's protected reviewer field.
