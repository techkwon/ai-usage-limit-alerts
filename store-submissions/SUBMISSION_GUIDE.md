# Submission Guide

This guide collects the current official submission pages and the asset requirements that matter for this extension. It is limited to the stores named by the request.

## One-package compatibility

| Field | Chrome Web Store | Microsoft Edge Add-ons | NAVER Whale Store |
| --- | --- | --- | --- |
| Package | ZIP with `manifest.json` at root | ZIP | ZIP |
| Manifest | Manifest V3 for new items | Manifest V3 supported | `manifest_version: 3` |
| Name | Maximum `75` characters | No public item-name limit found in the cited publish guide | Maximum `45` characters |
| Manifest description | Maximum `132` characters | Separate short and full listing fields | Maximum `132` characters |
| Short name | Maximum `12` characters | Use the manifest value | Maximum `12` characters |
| Current localized values | KO: name `12`, description `75`, short name `8`; EN: name `21`, description `126`, short name `9` | Both locale sets fit | Both locale sets fit |

Locale handling:

- The ZIP includes `_locales/ko` and `_locales/en`; the browser and each compatible store resolve localized manifest fields through `__MSG_*__`.
- Enter the Korean `ko` and English `en` listing copy from `STORE_LISTING.md` in any dashboard fields that support localization.
- Use the packaged short names: `AI 한도 알림` for Korean and `AI Limits` for English.
- The runtime shows Korean when the browser UI language begins with `ko`; every other browser UI language uses English.
- The screenshot harness supports `lang=ko|en` and `theme=light|dark` query parameters for locale- and theme-specific capture.
- Chrome localizes descriptions, screenshots, and video, but its small and marquee promotional tiles are global. Use the prepared English tiles for the world-targeted Chrome listing.

## Chrome Web Store

### Official URLs

- Register your developer account: <https://developer.chrome.com/docs/webstore/register>
- Set up your developer account: <https://developer.chrome.com/docs/webstore/set-up-account>
- Prepare your extension: <https://developer.chrome.com/docs/webstore/prepare>
- Publish in the Chrome Web Store: <https://developer.chrome.com/docs/webstore/publish>
- Complete your listing information: <https://developer.chrome.com/docs/webstore/cws-dashboard-listing>
- Supplying images: <https://developer.chrome.com/docs/webstore/images>
- Fill out privacy fields: <https://developer.chrome.com/docs/webstore/cws-dashboard-privacy>
- Provide test instructions: <https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions>
- Program policies: <https://developer.chrome.com/docs/webstore/program-policies/policies>
- Listing requirements: <https://developer.chrome.com/docs/webstore/program-policies/listing-requirements>
- User data and Limited Use FAQ: <https://developer.chrome.com/docs/webstore/program-policies/user-data-faq>
- Prepare distribution settings: <https://developer.chrome.com/docs/webstore/cws-dashboard-distribution>
- Review process: <https://developer.chrome.com/docs/webstore/review-process>
- Test instructions and privacy fields are covered in the publish flow: <https://developer.chrome.com/docs/webstore/publish>

### Current packaging and review flow

1. Register a Chrome Web Store developer account, complete two-step verification, and pay the one-time registration fee shown by Google.
2. Set up the developer account profile.
3. Load the extension locally and verify that it works before upload.
4. Package the extension as a ZIP file.
5. Upload the ZIP in the Chrome Developer Dashboard.
6. Fill out the store listing, privacy, distribution, and test instruction fields.
7. Submit for review.
8. If needed, defer publishing until review completes.

### Chrome asset requirements

| Asset | Requirement |
| --- | --- |
| Store icon | `128x128` |
| Screenshots | At least `1`, up to `5`, each `1280x800` |
| Small promo tile | `440x280` PNG or JPEG, global rather than locale-specific |
| Marquee promo tile | `1400x560` PNG or JPEG, optional and global rather than locale-specific |
| Video | Check the live dashboard; the official listing page calls it required while the official image page says only icon, small tile, and screenshot are mandatory |

### Chrome checklist notes

- The privacy policy must be accurate and up to date if the item handles user data.
- Declare one narrow purpose and justify `storage`, `alarms`, `notifications`, and each host permission.
- Disclose locally handled usage and authentication/session-related data accurately. "Not sent to the developer" does not mean the data is never handled by the extension.
- The listing must clearly describe what the extension does.
- Paste the Korean and English listing copy into the locale fields supported by the dashboard.
- Distribution can be public, unlisted, or private.
- Private visibility is typically used for testing before public launch.
- The test instructions tab is only needed when reviewers need instructions or credentials.
- Do not use `#1`, `best`, `ultimate`, duplicated keywords, or performance claims that cannot be substantiated.

## Microsoft Edge Add-ons

### Official URLs

- Register as a Microsoft Edge extension developer: <https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account>
- Publish a Microsoft Edge extension: <https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension>
- Developer policies: <https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies>
- Manifest file format: <https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/manifest-format>
- Submission states: <https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/submission-states>

### Current packaging and review flow

1. Register a Microsoft account and enroll it as a Microsoft Edge extension developer account.
2. Create the extension in Partner Center.
3. Package the extension as a ZIP file.
4. Upload the ZIP package.
5. Fill in the privacy page, store listing, and per-language fields.
6. Save a draft when needed.
7. Submit the extension for review.
8. Track the submission through the Partner Center states.

### Edge asset requirements

| Asset | Requirement |
| --- | --- |
| Extension logo | `128x128` minimum; `300x300` recommended |
| Screenshots | Optional, up to `6`, each `640x480` or `1280x800` |
| Small promotional tile | Optional, `440x280` |
| Large promotional tile | Optional, `1400x560` |
| Video | Optional YouTube link |

### Edge listing limits

- Full description: `250` to `10,000` characters.
- Search terms: up to `7` entries, up to `21` words total, maximum `30` characters per entry.
- Provide at least one language's short description and full listing.
- The official review-status guide says certification can take up to seven business days; actual timing can vary.
- Use the Korean `ko` and English `en` listing copy where Partner Center exposes per-language fields.

### Edge submission states

| State | Meaning |
| --- | --- |
| In draft | Saved in Partner Center, not submitted yet. |
| In review | Submitted and under Microsoft review. |
| Waiting to publish | Review complete, pending publication. |
| In the store | Published and available in the store markets you selected. |
| In the store. Update in review | Published item with an update under review. |
| Review failed | Submission failed review and needs correction. |

### Edge checklist notes

- The privacy page must disclose the extension's purpose, permissions, data usage, and privacy policy.
- If the extension accesses, collects, or transmits personal information, a privacy policy URL is required.
- The extension package is uploaded as a ZIP file and is converted during publishing.
- The store listing must be truthful and must not mislead users about functionality.

## Whale Store

### Official URLs

- Whale developer center home: <https://whale.dev/>
- Store registration flow: <https://whale.dev/distribution/>
- Review guide: <https://whale.dev/review_guides/>
- Browser API reference: <https://developers.whale.naver.com/api/>
- Developer registration page: <https://store.whale.naver.com/developers>
- Test and debugging guide: <https://developers.whale.naver.com/tutorials/debugging/>

### Current packaging and review flow

1. Sign in to Whale Store with a Naver ID.
2. Complete developer registration.
3. Prepare the extension package as a ZIP file.
4. Upload the package and fill in the language-specific listing fields.
5. Add the icon, screenshots, description, category, and visibility setting.
6. Save a draft if needed.
7. Request review.
8. After approval, the extension becomes available in Whale Store.

### Whale asset requirements

| Asset | Requirement |
| --- | --- |
| Extension icon | `128x128` PNG |
| Screenshots | Minimum `1`, maximum `4`, each `1280x800`, JPG or PNG |

### Whale listing limits

- Name: maximum `45` characters.
- Manifest description: maximum `132` characters.
- Short name: maximum `12` characters.
- Detailed description is plain text; do not rely on Markdown or HTML formatting in the submission form.
- Use the Korean `ko` and English `en` listing copy where Whale exposes per-language fields.

### Whale checklist notes

- The listing must accurately describe the extension.
- Screenshots must be clear and informative.
- The extension must be complete, secure, and usable on its own.
- The review guide requires accuracy, completeness, usability, security, privacy, rights, monetization, and Whale/Naver service compatibility checks.
- Developer registration is performed with a Naver account. The cited official pages do not document a registration fee, a dedicated reviewer-notes field, or a mandatory privacy-policy URL; verify the live form before final submission.

## Staleness and dashboard check

Store forms change. Recheck every numerical limit and required field in the live dashboard on the submission date. In particular, Chrome's older official listing page and image guide disagree about the promotional-video requirement; the live dashboard is the final operational source.
