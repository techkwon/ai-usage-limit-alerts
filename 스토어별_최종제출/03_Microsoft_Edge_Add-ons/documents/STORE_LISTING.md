# Store Listing Copy

Use this copy for the Chrome Web Store, Microsoft Edge Add-ons, and Whale Store. Enter the Korean text in `ko` locale fields and the English text in `en` locale fields where the dashboard supports them.

## Metadata

| Field | Korean (`ko`) | English (`en`) | Note |
| --- | --- | --- | --- |
| Title | `AI 사용량 한도 알림` | `AI Usage Limit Alerts` | Current manifest title length: `12` / `21`. |
| Manifest short name | `AI 한도 알림` | `AI Limits` | Localized lengths: `8` / `9`; both stay within the `12`-character limit. |
| Category | `Productivity` | `Productivity` | Same across stores. |
| Positioning | `로그인된 AI 서비스의 사용량과 리셋을 배지, 팝업, 페이지 위젯에서 보여 주는 추적기.` | `Usage and reset tracker for signed-in AI services, shown in the badge, popup, and page overlay.` | Keep this factual. |
| Monetization | `완전 무료 · 광고 없음 · 구독 없음` | `Completely free · No ads · No subscription` | Use only where the store asks for monetization or a short value proposition. |

The manifest uses `__MSG_*__` references with `default_locale: en`. The packaged descriptions are `75` Korean characters and `126` English characters, both within the `132`-character limit.

## Short Description

### Korean

완전 무료 · 광고 없음 · 구독 없음. ChatGPT·Claude·Gemini·Grok의 사용량과 리셋을 팝업과 페이지 위젯에서 확인하고 Claude 사용률 배지와 한도 알림을 받으세요.

### English

Completely free · No ads · No subscription. Track ChatGPT, Claude, Gemini, and Grok usage and resets with popup and in-page meters, a Claude badge, and local limit alerts.

## Full Copy

### Korean

AI 사용량 한도 알림은 완전 무료 · 광고 없음 · 구독 없음인 브라우저 확장입니다. 로그인된 ChatGPT, Claude, Gemini, Grok 계정의 사용량과 리셋 시점을 팝업과 각 서비스 페이지의 위젯에서 확인할 수 있고, 툴바 배지에는 Claude의 가장 높은 사용률이 표시됩니다. 팝업과 페이지 위젯은 브라우저의 라이트/다크 테마를 자동으로 따릅니다.

확장 프로그램은 현재 브라우저의 로그인 세션을 이용해 각 서비스 도메인에 직접 요청합니다. 사용량 조회 결과, 알림 중복 방지 상태, Claude 조직 목록·선택 정보와 Gemini 요청용 토큰은 브라우저 로컬 저장소에 보관되며 개발자 서버로 보내지지 않습니다. ChatGPT 요청용 액세스 토큰은 메모리에서 일시적으로만 사용합니다. 채팅 내용, 프롬프트, 비밀번호, 결제 정보, 광고 식별자와 개발자 분석 데이터는 수집하지 않습니다.

지원 기능:

- Claude, ChatGPT, Gemini, Grok의 사용량 상태 표시
- 세션 및 주간 한도, 기능별 잔여 횟수, 모델별 쿼리 한도 표시
- 상태 리셋 시점 확인
- Claude 사용률 툴바 배지, 팝업, 페이지 오버레이 제공
- 80%·100% 도달, 잔여 횟수 소진, 리셋 시 로컬 브라우저 알림

### English

AI Usage Limit Alerts is a completely free browser extension with no ads and no subscription. It shows usage and reset timing for signed-in ChatGPT, Claude, Gemini, and Grok accounts in the popup and on each service page, and the toolbar badge shows the highest Claude utilization. The popup and in-page widgets follow the browser's light/dark theme automatically.

The extension uses the current browser sign-in session to request data directly from each service domain. Usage results, notification state, Claude organization selection, and a Gemini request token are stored locally and are not sent to a developer server. A ChatGPT access token is used transiently in memory. The extension does not collect chat content, prompts, passwords, payment information, ad identifiers, or developer analytics.

Key features:

- Usage status for Claude, ChatGPT, Gemini, and Grok
- Session and weekly limits, feature-based remaining counts, and model-based query limits
- Reset timing visibility
- Claude toolbar badge, popup, and in-page overlay
- Local alerts at usage thresholds, exhaustion, and reset

## Edge Search Terms

Use exactly seven relevant search terms.

1. `AI 사용량`
2. `AI usage`
3. `usage tracker`
4. `Claude usage`
5. `ChatGPT usage`
6. `Gemini usage`
7. `Grok usage`

## Non-Affiliation Notice

This extension is an independent project and is not affiliated with or endorsed by OpenAI, Anthropic, Google, or xAI. Service names are used only to describe compatibility.
