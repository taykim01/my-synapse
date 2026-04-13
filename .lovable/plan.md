

## Problem Analysis

When using the iOS Shortcut:
- **`webapp://synapse.site/share?url=...`** opens the PWA but the capture fails -- likely because `webapp://` is a non-standard scheme and `BrowserRouter` / `useSearchParams` can't parse the query params from it.
- **`https://synapse.site/share?url=...`** opens in Safari (not the PWA) but capture works perfectly.

## Root Cause

`webapp://` is an undocumented iOS scheme. When the PWA opens via it, `window.location.search` is likely empty or the URL is malformed from React Router's perspective. `useSearchParams()` returns nothing, so the share page processes an empty capture.

## Plan

### 1. Make Share.tsx resilient to `webapp://` scheme

Instead of relying solely on `useSearchParams()` (which depends on `BrowserRouter` parsing a standard URL), also parse `window.location.href` directly as a fallback. This handles cases where the scheme is non-standard:

```typescript
// Fallback: parse params from raw URL if useSearchParams is empty
const rawUrl = window.location.href;
const paramString = rawUrl.includes("?") ? rawUrl.split("?").slice(1).join("?") : "";
const fallbackParams = new URLSearchParams(paramString);

const title = searchParams.get("title") || fallbackParams.get("title") || "";
const text = searchParams.get("text") || fallbackParams.get("text") || "";
const url = searchParams.get("url") || fallbackParams.get("url") || "";
```

### 2. Update iOS Share Guide

Update the recommended shortcut URL to use `webapp://` scheme (since it opens the PWA directly), now that the code will handle it properly. Add a note that if `webapp://` doesn't work on their device, they can fall back to `https://`.

### Files Changed
- **`src/pages/Share.tsx`** -- Add raw URL parsing fallback
- **`src/pages/IOSShareGuide.tsx`** -- Update recommended URL scheme to `webapp://` with `https://` fallback note

