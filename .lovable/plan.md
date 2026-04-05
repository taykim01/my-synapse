

## 캡처 키워드 자동 매칭 — AI 직접 선택 방식

### 핵심 아이디어

Embedding 벡터를 생성/비교하는 대신, AI에게 캡처 내용과 키워드 목록을 제공하고 **가장 적합한 키워드를 직접 선택**하게 합니다. Tool-calling을 활용하여 구조화된 응답을 받습니다.

### 장점
- `nodes` 테이블에 embedding 컬럼 추가 불필요
- 별도 embedding 모델 불필요
- 코사인 유사도 계산 로직 불필요
- 더 직관적이고 정확한 의미적 매칭

### 구현 계획

#### 1. Edge Function: `assign-capture-keyword`

Lovable AI Gateway (`google/gemini-3-flash-preview`)를 사용하여 캡처 내용을 분석하고 최적 키워드를 선택합니다.

**콘텐츠 타입별 분석:**
- **TEXT**: `제목 + 설명`을 그대로 전달
- **LINK**: `fetch-url-metadata`로 이미 가져온 제목/설명 활용
- **FILE/IMAGE**: Supabase Storage URL을 AI에게 전달하여 분석 요청

**Tool-calling으로 구조화된 응답:**

```text
Tool: select_keyword
Parameters:
  - keyword_id: string (선택된 키워드 ID)
  - reason: string (선택 이유 — 디버깅용)
```

AI에게 유저의 키워드 목록(ID + 제목)과 캡처 내용을 제공하면, tool_call로 `keyword_id`를 반환합니다.

**흐름:**
```text
Client → DB에 capture 저장 (connected_to = null)
       → Edge Function 호출 (capture_id, title, description, content_type, content_url)
       → AI에게 키워드 목록 + 캡처 내용 전달
       → AI가 tool_call로 best keyword_id 반환
       → captures.connected_to 업데이트 (service_role_key 사용)
       → 클라이언트에 keyword_id 응답
```

#### 2. `galaxyStore.ts` — `addCapture` 수정

- `addCapture`를 **async**로 변경
- DB에 캡처 저장 후, Edge Function 호출
- 응답받은 `connected_to`로 로컬 그래프 상태 업데이트
- 랜덤 키워드 선택 로직 제거

#### 3. `CaptureModal.tsx` — 로딩 상태 추가

- 저장 버튼 클릭 후 "AI가 관련 키워드를 찾고 있습니다..." 로딩 표시
- 완료 시 토스트로 연결된 키워드 알림

### 파일 변경 목록

| 파일 | 작업 |
|------|------|
| `supabase/functions/assign-capture-keyword/index.ts` | 새로 생성 — AI 키워드 매칭 Edge Function |
| `src/stores/galaxyStore.ts` | 수정 — addCapture async화, Edge Function 호출, 랜덤 로직 제거 |
| `src/components/CaptureModal.tsx` | 수정 — 저장 중 로딩 UI 추가 |

