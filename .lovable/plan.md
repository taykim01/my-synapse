

## Tutorial for New Users

### Approach
A passive, slideshow-style tutorial overlay — no user actions required. The user just clicks "Next" or swipes through 4-5 short slides explaining the core concepts. Fast, minimal energy.

### Slides Content (4 slides)
1. **네트워크 구조** — "나"를 중심으로 관심사 → 세부 키워드 → 캡처가 연결됩니다 (with legend colors)
2. **캡처 추가** — 오른쪽 하단 + 버튼으로 텍스트, 링크, 파일, 이미지를 저장하세요. AI가 자동으로 분류합니다.
3. **노드 탐색** — 노드를 클릭하면 상세 정보를 볼 수 있고, 검색으로 빠르게 찾을 수 있습니다.
4. **자동 연결** — 캡처가 쌓이면 AI가 유사한 것끼리 세부 키워드로 묶어줍니다.

### Technical Plan

**1. Create `src/components/TutorialOverlay.tsx`**
- Full-screen overlay with backdrop blur
- Array of slide objects (icon, title, description)
- Step indicator dots at bottom
- "다음" / "시작하기" buttons
- Smooth fade/slide transitions between steps
- Stores completion in `localStorage` key `synapse_tutorial_seen`

**2. Modify `src/pages/Index.tsx`**
- Import `TutorialOverlay`
- Show it when `localStorage.getItem('synapse_tutorial_seen')` is not `'true'` (first visit)
- Add `HelpCircle` icon button next to the `LogOut` button in the header
- Clicking it sets state to re-show the tutorial

**3. Files changed**
- `src/components/TutorialOverlay.tsx` (new)
- `src/pages/Index.tsx` (modified)

