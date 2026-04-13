

## Web Share Target 구현 계획

### 개요
다른 앱에서 콘텐츠(URL, 텍스트)를 공유할 때 Synapse PWA가 공유 대상으로 나타나도록 설정합니다.

### 변경 사항

**1. `vite-plugin-pwa` 설치 및 설정** (`vite.config.ts`)
- `vite-plugin-pwa` 패키지 설치
- 프리뷰/iframe 환경에서는 서비스 워커 비활성화
- `navigateFallbackDenylist`에 `/~oauth` 추가
- manifest에 `share_target` 정의:
```json
"share_target": {
  "action": "/share",
  "method": "GET",
  "params": {
    "title": "title",
    "text": "text",
    "url": "url"
  }
}
```

**2. 서비스 워커 가드 추가** (`src/main.tsx`)
- iframe/프리뷰 환경에서 서비스 워커 자동 해제

**3. 공유 수신 페이지 생성** (`src/pages/Share.tsx`)
- `/share` 라우트에서 쿼리 파라미터(`title`, `text`, `url`)를 읽어서 자동으로 캡처 생성
- 캡처 생성 후 `/network` 페이지로 리다이렉트

**4. 라우트 등록** (`src/App.tsx`)
- `/share` 경로 추가

### 제약사항 (사용자에게 안내)
- 에디터 프리뷰에서는 테스트 불가, 배포 후 모바일에서 PWA 설치 후 테스트 필요
- iOS Safari에서는 Web Share Target 지원이 제한적 (Android Chrome에서 가장 잘 동작)

