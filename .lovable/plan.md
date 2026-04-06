
## 캡처 유사도 기반 DetailedKeyword 자동 생성

### 1. DB 마이그레이션 — `nodes` 테이블 확장

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `type` | `text` (default `'keyword'`) | `keyword` 또는 `detailed_keyword` |
| `parent_id` | `uuid` (nullable, FK → nodes.id) | 상위 노드 참조 (계층 구조) |

- 기존 노드는 모두 `type = 'keyword'`로 유지
- DetailedKeyword는 `parent_id`로 상위 Keyword 또는 상위 DetailedKeyword를 참조

### 2. Edge Function — `check-capture-similarity`

캡처 추가 후 호출되어:
1. 새 캡처가 연결된 노드(Keyword/DetailedKeyword)의 모든 캡처 임베딩을 조회
2. 새 캡처와 기존 캡처 간 코사인 유사도 계산
3. 유사도가 **μ = 0.3** 이하인 쌍이 발견되면:
   - AI에게 두 캡처의 내용을 주고, 저유사도 캡처를 위한 새 DetailedKeyword 이름을 생성
   - `nodes` 테이블에 `type = 'detailed_keyword'`, `parent_id = 현재 노드 ID`로 새 노드 삽입
   - 저유사도 캡처의 `connected_to`를 새 DetailedKeyword로 업데이트
4. 결과 반환: 새로 생성된 DetailedKeyword 정보

### 3. 프론트엔드 — `galaxyStore.ts` + `GalaxyCanvas.tsx`

- `addCapture` 후 `check-capture-similarity` 호출
- 새 DetailedKeyword가 생성되면 그래프에 노드/링크 추가
- `initFromDB`에서 `parent_id`와 `type`을 활용하여 계층 구조 빌드

### 유사도 임계값 (μ)

- 기본값: **0.3** (필요 시 조정 가능)
- 같은 노드에 연결된 캡처들 중 새 캡처와의 유사도가 이 값 이하이면 분리 대상
