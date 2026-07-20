# 개인정보처리방침 / Privacy Policy

**제품명 / Product:** AI 사용량 한도 알림

**시행일 / Effective date:** 2026-07-20

**문의 / Support email:** [배포 전 입력: support email]

**공개 정책 URL / Public policy URL:** [배포 전 입력: public privacy policy URL]

이 문서는 확장 프로그램이 현재 코드 기준으로 데이터를 어떻게 처리하는지 설명합니다.

## 1. 목적

사용자가 브라우저에서 이미 로그인한 ChatGPT, Claude, Gemini, Grok 계정의 사용량, 잔여 횟수와 리셋 시점을 표시하고 로컬 알림을 제공하는 것이 유일한 목적입니다.

## 2. 접근하거나 일시적으로 처리하는 데이터

확장 프로그램은 브라우저의 기존 로그인 상태를 이용해 다음 서비스에 직접 요청합니다.

- `https://claude.ai/*`
- `https://chatgpt.com/*`
- `https://gemini.google.com/*`
- `https://grok.com/*`

처리 범위는 사용량 퍼센트, 잔여 횟수, 한도 구분, 리셋 시각, Claude 조직 선택 정보, 요청에 필요한 세션 관련 값입니다. 브라우저가 로그인 쿠키를 각 서비스 요청에 자동으로 포함할 수 있지만, 확장 프로그램은 사용자의 비밀번호를 읽지 않습니다.

- ChatGPT 액세스 토큰은 사용량 요청을 위해 메모리에서 일시적으로 사용하며 `chrome.storage.local`에 저장하지 않습니다.
- Gemini 요청용 위조 방지 토큰은 효율적인 갱신을 위해 브라우저 로컬 저장소에 캐시합니다.
- Claude에서 조회된 조직 식별자, 조직 표시 이름과 요금제 구분 목록은 올바른 사용량 엔드포인트를 선택하기 위해 로컬에 저장할 수 있습니다.

## 3. 브라우저에 로컬로 저장하는 데이터

다음 키가 `chrome.storage.local`에 저장될 수 있습니다.

- `usage_claude`, `usage_chatgpt`, `usage_grok`, `usage_gemini`: 사용량, 잔여 횟수, 리셋 시각, 조회 시각과 표시용 라벨
- `claudeOrg`: 선택한 조직과 조회된 조직 목록의 식별자, 표시 이름, 요금제 구분과 조회 시각
- `geminiToken`: Gemini 요청용 토큰과 갱신 시각
- `notify_state`: 같은 임계치 알림을 반복하지 않기 위한 로컬 상태

이 데이터는 사용자의 브라우저 프로필에만 저장되며 개발자가 운영하는 서버로 전송되지 않습니다.

## 4. 외부 전송과 제3자 제공

사용량 조회 요청은 위에 명시한 각 서비스 도메인으로만 직접 전송됩니다. 확장 프로그램에는 개발자 백엔드, 광고 SDK 또는 분석 SDK가 없습니다. 개발자는 데이터를 판매하거나 제3자에게 제공하지 않습니다.

각 서비스가 자체적으로 데이터를 처리하는 방식은 해당 서비스의 개인정보처리방침과 이용약관을 따릅니다.

## 5. 수집하지 않는 데이터

개발자는 다음 데이터를 수집하거나 보관하지 않습니다.

- 채팅 내용과 프롬프트
- 비밀번호, 복구 코드와 결제 정보
- 광고 식별자
- 검색·탐색 기록
- 개발자 측 분석 이벤트, 충돌 리포트 또는 원격 텔레메트리

## 6. 권한 사용 목적

- `storage`: 사용량 캐시, 요청 보조 값과 알림 중복 방지 상태의 로컬 저장
- `alarms`: 일정한 간격의 사용량 갱신
- `notifications`: 한도 임계치, 소진과 리셋에 대한 로컬 알림
- 네 개의 호스트 권한: 로그인된 각 서비스의 사용량·한도 엔드포인트에 직접 요청하고 해당 페이지에 사용량 위젯 표시

## 7. 보관 기간과 삭제

로컬 캐시는 새 조회 결과로 덮어쓰며, 사용자가 확장 프로그램 데이터를 삭제하거나 확장 프로그램을 제거할 때 삭제할 수 있습니다. 개발자 서버에 사본이 없으므로 별도의 원격 삭제 요청은 필요하지 않습니다.

## 8. 변경과 문의

데이터 처리 방식이 바뀌면 배포 전에 이 문서를 갱신합니다. 개인정보 관련 문의는 위의 지원 이메일로 받을 수 있습니다.

## English summary

The extension uses the browser's existing sign-in sessions to request usage and reset data directly from `claude.ai`, `chatgpt.com`, `gemini.google.com`, and `grok.com`. Usage caches, Claude organization selection, a Gemini request token, and notification state may be stored in `chrome.storage.local`. A ChatGPT access token is used transiently in memory and is not persisted.

No data is sent to a developer-operated server. The developer does not collect chats, prompts, passwords, payment information, browsing history, advertising identifiers, analytics, or telemetry. Users can delete local extension data through browser controls or by removing the extension.
