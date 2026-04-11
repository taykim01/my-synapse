

## Problem

The `fetch-url-metadata` edge function fails with "Maximum number of redirects (20) reached" for certain URLs (e.g., `https://www.nyrr.org/tcsnycmarathon`). These sites create infinite redirect loops that Deno's fetch cannot resolve, causing a 500 error.

## Solution

Two changes to `supabase/functions/fetch-url-metadata/index.ts`:

1. **Handle redirects manually** in `fetchGeneralMetadata` -- use `redirect: 'manual'` and follow redirects manually with a cap of 5 hops. This prevents the infinite redirect loop.

2. **Graceful fallback on failure** -- if fetching still fails (timeout, redirect loop, blocked by WAF, etc.), return a partial metadata response using the URL's domain as `site_name` and a cleaned-up path as `title`, instead of returning a 500 error. This ensures captures can always be created even when metadata extraction fails.

## Technical Details

**File: `supabase/functions/fetch-url-metadata/index.ts`**

- Add a `fetchWithRedirects(url, headers, maxRedirects=5)` helper that uses `redirect: 'manual'` and follows `Location` headers up to 5 times
- Replace `fetch()` calls in `fetchGeneralMetadata` with this helper
- Wrap the top-level try/catch to return fallback metadata (`{ title: hostname + path, thumbnail: '', description: '', site_name: hostname }`) instead of a 500 error
- Add a timeout via `AbortSignal.timeout(10000)` to prevent hanging on slow sites

