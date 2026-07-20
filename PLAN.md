# AI Usage Meter — 크롬 확장 개발 플랜

AI 웹서비스(Claude → ChatGPT → Gemini → Grok)의 사용량/한도를 표시하는 Chrome 확장(Manifest V3).

## 검증 루트 (확정)

각 플랫폼 공통 검증 절차 — 로그인된 브라우저에서 DevTools 콘솔 실행:

### Claude (1차 검증 대상)
```js
// 1) org_id 획득
fetch('/api/organizations', {credentials:'include'}).then(r=>r.json()).then(console.log)
// 2) 사용량 조회
fetch(`/api/organizations/${orgId}/usage`, {credentials:'include'}).then(r=>r.json()).then(console.log)
```
**✅ 실계정 검증 완료 (2026-07-20, Max 5x 계정)** — 실제 응답 요약:
```json
{
  "five_hour": { "utilization": 6.0, "resets_at": "2026-07-20T03:09:59+00:00" },
  "seven_day": { "utilization": 2.0, "resets_at": "2026-07-25T08:59:59+00:00" },
  "seven_day_opus": null,

  "limits": [
    { "kind": "session",       "group": "session", "percent": 6, "severity": "normal", "resets_at": "...", "is_active": true },
    { "kind": "weekly_all",    "group": "weekly",  "percent": 2, "severity": "normal", "resets_at": "..." },
    { "kind": "weekly_scoped", "group": "weekly",  "percent": 1, "severity": "normal", "resets_at": "...",
      "scope": { "model": { "display_name": "Fable" } } }
  ],

  "extra_usage": { "is_enabled": false, "monthly_limit": 2000, "used_credits": 0.0, "utilization": 0.0 },
  "spend": { "percent": 0, "severity": "normal", "enabled": false }
}
```
구현 시사점:
- **`limits[]` 배열을 1차 소스로 사용** — kind(session/weekly_all/weekly_scoped) + percent + severity + resets_at + 모델 스코프까지 제공. UI에 그대로 매핑 가능.
- `five_hour`/`seven_day`는 레거시 필드로 백업 파싱 경로로 유지 (스키마 변경 대비 이중화).
- `severity` 값("normal"/경고 단계)을 배지 색상에 직접 활용 가능.
- 계정에 조직이 복수일 수 있음(개인 + 팀). `rate_limit_tier`에 `claude_max_5x` 같은 플랜 문자열 포함 → 개인 조직 자동 선택 휴리스틱: `raven`/`max`/`pro` tier 우선, 실패 시 사용자 선택 UI.
- utilization은 소수(6.0) — 반올림 표시.

### ChatGPT
**✅ 실계정 검증 완료 (2026-07-20, Pro 계정)**
1. `GET /api/auth/session` (쿠키) → `accessToken`
2. `POST /backend-api/conversation/init` (Bearer, body `{}`) → 응답:
```json
{
  "model_limits": [],
  "limits_progress": [
    { "feature_name": "deep_research", "remaining": 250, "reset_after": "ISO8601" },
    { "feature_name": "image_gen",     "remaining": 993, "reset_after": "ISO8601" }
  ]
}
```
- `limits_progress`: 기능별 잔여 횟수 (전 플랜 공통으로 보임)
- `model_limits`: Pro는 빈 배열(메시지 무제한). 한도 있는 플랜(Plus/무료)에서 채워질 것으로 추정 — 해당 플랜 계정으로 추가 검증 필요.
- 참고: `/backend-api/rate_limits`, `/backend-api/usage` 등 추측 경로는 404.

### Gemini
**✅ 실검증 완료 (2026-07-20, 무료 계정에서도 동작)**
1. `GET https://gemini.google.com/app` HTML에서 CSRF 토큰 추출: `"SNlM0e":"(.*?)"`
2. `POST /_/BardChatUi/data/batchexecute?rpcids=jSf9Qc&source-path=/usage`
   body: `f.req=[[["jSf9Qc","[]",null,"generic"]]]&at=<토큰>`
3. 응답 파싱: `inner = JSON.parse(outer[0][2])`, `limits = inner[1]`
   각 limit = `[remaining, usedRatio, type, [[resetEpochSec]]]` — type 1=5시간, 2=주간 (type 4도 존재, 용도 미상)
- 실측: 무료 계정 5h 잔여 600 / 주간 잔여 12096, 사용률 ratio, 리셋 epoch 포함
- 출처: Gemini Usage Monitor 확장 소스 분석(CRX) + 실계정 호출 검증
- 리스크: 비공개 RPC라 Google 개편 시 파손 가능 → 토큰 캐시 무효화 + 1회 재시도 로직 포함

### Grok
**✅ 실검증 완료 (2026-07-20)**
- `POST https://grok.com/rest/rate-limits` body `{"requestKind":"DEFAULT","modelName":"grok-4"}` (쿠키만, 토큰 불필요)
- 응답: `{"windowSizeSeconds":14400,"remainingQueries":2,"totalQueries":2}` — 모델별 창 길이 다름(grok-4: 4h, grok-3/heavy: 2h)
- 리셋 시각은 미제공(창 길이만). 비로그인 상태에서도 200 응답(익명 무료 한도).

**✅ 해결: 공유 주간 풀 (2026.6~7 도입)**
- 주간 풀 데이터는 `GetSharedUsage`가 아니라 **`POST /grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig`** 응답(gRPC-web protobuf)에 있음. (`GetSharedUsage` 등은 헛다리)
- 출처: Grok Rate Limit Display userscript(greasyfork 533963) 분석 → `GetGrokCreditsConfig` 가로채기 확인 → 초반에 이미 캡처했던 응답을 디코드해 검증.
- **protobuf 구조** (검증 완료, 스크린샷 16%/API14%/채팅2%와 일치):
  ```
  field1 {
    1: f32  = 전체 주간 %            (16.0)
    5: { 1: varint = 리셋 epoch(sec) } (1784931099 = 2026-07-25)
    7 (repeated): { 1: product_id, 2: f32 % }   // id 1=API(14), 4=채팅(2)
  }
  ```
- **캡처 방식**: 직접 호출은 HTML 셸 반환 + connect 클라이언트가 로드시점 fetch 클로저 → `content/grok-interceptor.js`(document_start, world:MAIN)가 fetch/arrayBuffer/body-tee 3중으로 GetGrokCreditsConfig 응답을 잡아 디코드 → postMessage → `content/grok.js`가 `usage_grok_pool`로 storage 저장 → provider가 맨 위에 병합.
- 표시: "주간 한도 (API 14% · 채팅 2%) 16% + 리셋 시각" (풀) + "Grok 4/3 남은 N/N회"(모델별).
- 리스크: 비공개 gRPC라 xAI 개편 시 파손 가능. product_id 매핑(1=API,4=채팅)은 실측 2건 기준 — Imagine/Build(2/5 추정) 라벨은 미검증.

## 아키텍처

```
useage/
├── manifest.json          # MV3, 최소 권한
├── background.js          # service worker: alarms 폴링, 배지 갱신, 캐시
├── providers/
│   ├── index.js           # provider 레지스트리
│   ├── claude.js          # fetchUsage() 구현 (Phase 1)
│   ├── chatgpt.js         # (Phase 2)
│   ├── gemini.js          # (Phase 3)
│   └── grok.js            # (Phase 3)
├── content/
│   └── overlay.js         # 페이지 내 사용량 바 (입력창 하단, 스크린샷 스타일)
├── popup/
│   ├── popup.html/js/css  # 툴바 팝업: 전 서비스 사용량 대시보드
└── _locales/ko, en        # i18n
```

### 공통 Provider 인터페이스
```js
// 모든 provider가 구현
async fetchUsage() -> {
  ok: boolean,
  windows: [ { label: '5h'|'week'|..., utilization: 0-100, resetsAt: Date } ],
  error?: 'not_logged_in' | 'schema_changed' | 'network'
}
```

### 권한 설계 (심사 통과 최적화)
- `permissions`: `storage`, `alarms`
- `host_permissions`: `https://claude.ai/*` (Phase별로 chatgpt.com, gemini.google.com, grok.com 추가는 optional_host_permissions로 — 사용자가 서비스별 옵트인)
- 금지: `cookies`, `tabs`, `webRequest`, `<all_urls>` — 쿠키는 host 권한만으로 자동 동봉됨

## 개발 단계

### Phase 1 — Claude MVP
1. manifest + background(alarms 5분 폴링, org_id 캐시 24h)
2. claude provider: `/api/organizations` → `/usage` 호출, 403 시 "로그인 필요" 상태
3. 팝업 UI: 5h/주간(/Opus) 진행바 + 리셋 카운트다운
4. 툴바 배지: 최고 사용률 % 색상 코드(녹/황/적)
5. content script 오버레이(선택): claude.ai 입력창 하단에 미니 바
6. 실계정 검증: 응답 스키마 확인 → 스키마 어긋나면 provider 수정

### Phase 2 — ChatGPT
1. 검증 루트로 실제 엔드포인트/스키마 캡처
2. chatgpt provider 구현 (서버 제공 한도 우선, 불가 시 로컬 집계 fallback)
3. optional_host_permissions 옵트인 UI

### Phase 3 — Gemini / Grok
1. Grok: rate-limits 엔드포인트 provider
2. Gemini: batchexecute 분석 후 구현, "동작 불가 시 자동 비활성" 가드 필수

### Phase 4 — 배포
1. 아이콘/스토어 설명(한/영), 프라이버시 정책(외부 전송 없음 명시)
2. Chrome Web Store 등록

## 리스크 & 대응
| 리스크 | 대응 |
|---|---|
| 내부 API 변경으로 파손 | provider별 스키마 검증 + 실패 시 "일시 중단" 표시, 원격 아님·로컬만 |
| 미로그인/세션 만료 | 403 감지 → "로그인 필요" 배지 |
| 폴링 과다 | 5분 기본, 탭 활성 시에만 단축 |
| 스토어 심사 | 최소 권한 + optional host permission + 명확한 프라이버시 문구 |
