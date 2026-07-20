# AI 사용량 한도 알림

로그인된 ChatGPT, Claude, Gemini, Grok 계정의 사용량, 잔여 횟수와 리셋 시점을 팝업과 각 서비스 페이지에서 확인하는 Manifest V3 브라우저 확장입니다.

**완전 무료 · 광고 없음 · 구독 없음**

**Completely free · No ads · No subscription**

## 주요 기능

- 네 AI 서비스의 사용량을 한 팝업에서 확인
- 각 서비스 페이지의 사이드바 카드와 입력창 하단 미터
- Claude의 가장 높은 사용률을 툴바 배지로 표시
- 80%·100% 도달, 잔여 횟수 소진, 리셋 시 로컬 알림
- 사용량 캐시와 알림 상태를 브라우저 로컬 저장소에만 보관
- 브라우저 UI 언어가 한국어이면 한국어, 그 외 언어이면 영어로 표시
- 브라우저·운영체제 설정에 따른 라이트/다크 모드 자동 전환

## 개발자 모드 설치

1. Chrome, Edge 또는 Whale에서 확장 프로그램 관리 화면을 엽니다.
2. 개발자 모드를 켭니다.
3. `압축해제된 확장 프로그램을 로드`하고 이 프로젝트 폴더를 선택합니다.
4. 사용하는 AI 서비스에 로그인한 뒤 팝업과 페이지 위젯을 확인합니다.

## 검증

```powershell
node --test tests/provider-normalization.test.mjs tests/optimization-red.test.mjs tests/html-safety.test.mjs tests/i18n-theme-contracts.test.mjs
```

테스트는 네 공급자의 응답 정규화, 공급자별 새로고침, 동시 요청 합치기, 알림 상태 보존, MV3 메시지 수명, HTML 라벨 이스케이프, 한·영 국제화와 라이트/다크 테마 계약을 검증합니다.

## 스토어 패키지

```powershell
.\scripts\package-release.ps1
```

명령은 개발 전용 파일을 제외하고 `manifest.json`이 ZIP 루트에 있는 제출 패키지를 `dist/`에 만듭니다. 등록 문안, 개인정보처리방침, 심사 안내와 이미지 원본은 [store-assets](./store-assets/README.md)에 있습니다. 실제 등록에 사용할 Chrome·Whale·Edge별 완전 분리 묶음은 [스토어별 최종 제출 폴더](./스토어별_최종제출/00_여기부터_읽으세요.md)에 정리되어 있습니다.

## 개인정보

확장 프로그램은 브라우저의 기존 로그인 상태를 이용해 네 서비스 도메인에 직접 요청합니다. 개발자 백엔드, 광고 SDK와 분석 SDK는 없습니다. 공개 개인정보처리방침은 [GitHub Pages](https://techkwon.github.io/ai-usage-limit-alerts/privacy/)에서 확인할 수 있으며, 상세 원문은 [저장소 문서](./store-assets/PRIVACY_POLICY.md)에 있습니다.
