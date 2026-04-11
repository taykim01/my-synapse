const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/(?:watch|shorts)|youtu\.be\/)/i.test(url);
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u3131-\uD79D]+/g);
  return matches ? [...new Set(matches.map(t => t.replace('#', '')))] : [];
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

interface UrlMetadata {
  title: string;
  thumbnail: string;
  description: string;
  author?: string;
  keywords?: string[];
  category?: string;
  site_name?: string;
  type?: string;
}

async function fetchYouTubeMetadata(url: string): Promise<UrlMetadata> {
  const videoId = extractVideoId(url);
  const result: UrlMetadata = { title: '', thumbnail: '', description: '' };

  // 1. Try oEmbed for basic info (title, author)
  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (oembedRes.ok) {
      const data = await oembedRes.json();
      result.title = data.title || '';
      result.author = data.author_name || '';
      result.thumbnail = videoId
        ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        : data.thumbnail_url || '';
      result.site_name = 'YouTube';
      result.type = 'video';
    }
  } catch (e) {
    console.error('YouTube oEmbed failed:', e);
  }

  // 2. Fetch HTML page for description, tags, category
  try {
    const htmlRes = await fetchWithRedirects(url, {
      'User-Agent': 'Mozilla/5.0 (compatible; SynapseBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    });
    const html = await htmlRes.text();

    // og:description
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    if (ogDescMatch) {
      result.description = decodeHtmlEntities(ogDescMatch[1]);
    }

    // Fallback title from og:title if oEmbed failed
    if (!result.title) {
      const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
      if (ogTitleMatch) result.title = decodeHtmlEntities(ogTitleMatch[1]);
    }

    // meta keywords
    const keywordsMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']keywords["']/i);
    if (keywordsMatch) {
      result.keywords = keywordsMatch[1].split(',').map(k => k.trim()).filter(Boolean);
    }

    // Extract hashtags from description
    if (result.description) {
      const hashtags = extractHashtags(result.description);
      if (hashtags.length > 0) {
        result.keywords = [...(result.keywords || []), ...hashtags];
        result.keywords = [...new Set(result.keywords)];
      }
    }

    // og:video:tag (YouTube sometimes includes these)
    const tagMatches = html.matchAll(/<meta[^>]+property=["']og:video:tag["'][^>]+content=["']([^"']+)["']/gi);
    for (const m of tagMatches) {
      if (!result.keywords) result.keywords = [];
      result.keywords.push(decodeHtmlEntities(m[1]));
    }
    if (result.keywords) {
      result.keywords = [...new Set(result.keywords)];
    }

    // Genre/category from structured data
    const genreMatch = html.match(/"genre"\s*:\s*"([^"]+)"/);
    if (genreMatch) {
      result.category = decodeHtmlEntities(genreMatch[1]);
    }
  } catch (e) {
    console.error('YouTube HTML parsing failed:', e);
  }

  return result;
}

async function fetchWithRedirects(url: string, headers: Record<string, string>, maxRedirects = 5): Promise<Response> {
  let currentUrl = url;
  for (let i = 0; i < maxRedirects; i++) {
    const res = await fetch(currentUrl, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('Location');
      if (!location) break;
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects');
}

async function fetchGeneralMetadata(url: string): Promise<UrlMetadata> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; SynapseBot/1.0)',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  };
  const response = await fetchWithRedirects(url, headers);

  const html = await response.text();

  const getMetaContent = (property: string, isName = false): string => {
    const attr = isName ? 'name' : 'property';
    const m = html.match(new RegExp(`<meta[^>]+${attr}=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'))
      || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${property}["']`, 'i'));
    return m ? decodeHtmlEntities(m[1]) : '';
  };

  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

  const title = getMetaContent('og:title') || (titleTagMatch ? decodeHtmlEntities(titleTagMatch[1]) : '');
  const thumbnail = getMetaContent('og:image') || getMetaContent('twitter:image', true);
  const description = getMetaContent('og:description') || getMetaContent('description', true);
  const siteName = getMetaContent('og:site_name');
  const type = getMetaContent('og:type');

  const keywordsRaw = getMetaContent('keywords', true);
  const keywords = keywordsRaw ? keywordsRaw.split(',').map(k => k.trim()).filter(Boolean) : undefined;

  // Extract hashtags from description
  let allKeywords = keywords || [];
  if (description) {
    const hashtags = extractHashtags(description);
    if (hashtags.length > 0) {
      allKeywords = [...allKeywords, ...hashtags];
      allKeywords = [...new Set(allKeywords)];
    }
  }

  return {
    title: title.trim(),
    thumbnail,
    description: description.trim(),
    site_name: siteName || undefined,
    type: type || undefined,
    keywords: allKeywords.length > 0 ? allKeywords : undefined,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let rawUrl = '';
  try {
    const body = await req.json();
    rawUrl = body.url || '';
    if (!rawUrl) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let formattedUrl = rawUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const metadata = isYouTubeUrl(formattedUrl)
      ? await fetchYouTubeMetadata(formattedUrl)
      : await fetchGeneralMetadata(formattedUrl);

    return new Response(JSON.stringify(metadata), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    // Graceful fallback: return partial metadata from the URL itself
    if (rawUrl) {
      try {
        const urlObj = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
        const pathTitle = urlObj.pathname.replace(/\//g, ' ').trim() || urlObj.hostname;
        return new Response(JSON.stringify({
          title: pathTitle,
          thumbnail: '',
          description: '',
          site_name: urlObj.hostname,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (_) { /* ignore */ }
    }
    return new Response(JSON.stringify({ error: 'Failed to fetch metadata' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
