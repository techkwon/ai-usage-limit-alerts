# Release Checklist

Use this checklist before packaging and submitting the extension.

## Package

- [x] Manifest version is confirmed as `1.0.0` for the first submission.
- [x] The extension ZIP contains only the runtime files needed by the store package.
- [x] `store-assets/` is excluded from the extension ZIP.
- [x] Icons are present and sized correctly.
- [ ] The package installs locally before submission.
- [x] Provider normalization, optimization, HTML safety, i18n, and theme regression tests pass (`26/26`).

## Listing

- [x] The final title is `AI 사용량 한도 알림`.
- [x] Localized titles are `AI 사용량 한도 알림` and `AI Usage Limit Alerts`.
- [x] Localized short names are `AI 한도 알림` and `AI Limits`.
- [ ] The Korean and English locale copy has been pasted into the dashboard fields that support localization.
- [x] The monetization line is explicit in both locales: `완전 무료 · 광고 없음 · 구독 없음` / `Completely free · No ads · No subscription`.
- [x] The short descriptions are accurate in Korean and English.
- [x] The full descriptions do not use superlatives or misleading claims.
- [x] The non-affiliation notice is present.
- [x] The search terms are relevant and limited.

## Privacy

- [ ] The privacy policy URL is filled in.
- [ ] The support email is filled in.
- [x] The effective date is filled in.
- [x] The privacy policy matches the extension's current data flow.
- [x] The policy says the extension does not collect chats, prompts, passwords, payment info, analytics, or ads data.
- [x] The policy says the extension uses direct browser requests to signed-in services and stores state locally.

## Review prep

- [ ] Test accounts are ready.
- [x] Review notes are included in each store handoff folder.
- [x] Chrome, Edge, and Whale image sizes match the target store.
- [x] Locale-specific screenshot exports are prepared for `lang=ko` and `lang=en`.
- [x] Light and dark theme screenshot exports are prepared for both locales.
- [x] Screenshots contain no email address, account name, avatar, conversation, prompt, or other personal data.
- [x] ZIP packaging was verified after the final edit.
- [ ] The store-specific submission fields are complete.

## Store-specific image sizes

### Chrome

- [x] Four Korean and four English screenshots are verified at `1280x800`.
- [x] The prepared set is within the five-screenshot maximum.
- [x] The world-targeted global English small promo tile is verified at `440x280`.
- [ ] The current dashboard is checked for its promotional-video field. Chrome's official listing and image pages conflict on whether a YouTube video is mandatory.

### Edge

- [x] Four Korean and four English screenshots are verified at `1280x800`.
- [x] The prepared set is within the six-screenshot maximum.
- [x] The small promo tile is verified at `440x280`.
- [x] Korean and English large promo tiles are verified at `1400x560`.

### Whale

- [x] Four Korean and four English screenshots are verified at `1280x800`.
- [x] The prepared set is within the one-to-four screenshot range.
- [x] The icon is `128x128`.
