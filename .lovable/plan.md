

## YouTube watch 링크 메타데이터 문제 해결

### 원인
YouTube `watch?v=` 페이지는 봇에게 최소한의 HTML만 반환하여 og:title이 " - YouTube", og:image가 빈 값으로 옵니다. 하지만 YouTube는 **oEmbed API**와 **noembed.com** 같은 공개 API를 통해 메타데이터를 제공합니다.

### 해결 방법
YouTube URL이 감지되면 **YouTube oEmbed API** (`https://www.youtube.com/oembed?url=...&format=json`)를 사용하여 제목과 썸네일을 가져옵니다. oEmbed는 JS 렌더링 없이 정확한 데이터를 반환합니다.

- 썸네일: video ID에서 `https://i.ytimg.com/vi/{VIDEO_ID}/hqdefault.jpg` 직접 생성 (oEmbed 썸네일보다 고화질)

### 파일 변경

| 파일 | 작업 |
|------|------|
| `supabase/functions/fetch-url-metadata/index.ts` | YouTube URL 감지 시 oEmbed API 우선 사용하는 분기 추가 |

### 구현 상세

`fetch-url-metadata/index.ts`에서:

1. URL이 YouTube 도메인(`youtube.com/watch`, `youtu.be/`, `youtube.com/shorts/`)인지 확인
2. YouTube URL이면 oEmbed API 호출: `https://www.youtube.com/oembed?url=${url}&format=json`
3. 응답에서 `title`, `thumbnail_url` 추출
4. 썸네일은 video ID 기반 고화질 URL로 대체: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
5. YouTube가 아닌 URL은 기존 HTML 파싱 로직 유지

```text
요청 URL
  → YouTube URL인가?
    → Yes: oEmbed API 호출 → title, thumbnail 반환
    → No: 기존 HTML fetch + 메타태그 파싱
```

