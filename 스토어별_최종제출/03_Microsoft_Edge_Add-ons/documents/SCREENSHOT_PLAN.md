# Screenshot Plan

Create all store screenshots at `1280x800` so the same source set can be used in Chrome, Edge, and Whale.

## Locale and theme variants

The screenshot harness supports `?lang=ko|en` and `?theme=light|dark`.

- `screenshots/ko/` contains the Korean listing set.
- `screenshots/en/` contains the English listing set.
- Each locale includes two popup screenshots and two page-widget screenshots, split across light and dark themes.

## Capture order

| File in each locale folder | Scene | Theme | Korean caption | English caption |
| --- | --- | --- | --- | --- |
| `01-all-services-popup-light.png` | Four-provider popup | Light | 네 AI 서비스 사용량을 한눈에 | Four AI services. One clear view. |
| `02-all-services-popup-dark.png` | Four-provider popup | Dark | 다크 모드에서도 선명한 한도 확인 | Clear limit tracking in dark mode |
| `03-claude-page-widget-light.png` | Claude page widget and composer bar | Light | 페이지를 떠나지 않고 Claude 한도 확인 | Check Claude limits without leaving the page |
| `04-chatgpt-page-widget-dark.png` | ChatGPT page widget and composer bar | Dark | 대화 중에도 사용량과 잔여 횟수 확인 | Track usage and remaining counts while you chat |

## Captured assets

- Eight localized screenshots are captured and verified at `1280x800`.
- `../promotional/ko/` and `../promotional/en/` each contain verified `440x280` and `1400x560` tiles.
- All assets use labeled sample data and show the factual hook `완전 무료 · 광고 없음 · 구독 없음` or `Completely free · No ads · No subscription`.
- A notification screenshot is intentionally not fabricated. Add one only when a real threshold or reset notification can be captured without personal data.

## Privacy-safe capture rules

- Use a clean browser window at exactly `1280x800`.
- Hide bookmarks, downloads, unrelated tabs, account email, avatar, organization name, conversations, prompts, and page history.
- Do not show passwords, access tokens, cookies, DevTools, extension IDs, billing details, or API responses.
- Usage percentages and reset times may be real only when they cannot identify an account. Otherwise use a clearly labeled demo profile.
- Capture only functionality that the submitted version actually provides.
- Keep the extension popup or page widget large enough to read at store thumbnail size.
- Do not place `#1`, `best`, awards, ratings, user counts, or unsupported performance claims on the image.

## Store selection

- Chrome: add Korean and English localized listings; upload the four matching images to each locale and use `01` first.
- Edge: add Korean and English store-listing languages; upload the matching four-image set and localized promo tiles per language.
- Whale: upload the four-image Korean set, and add the English set when the dashboard exposes an English listing locale.
