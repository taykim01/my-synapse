import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MIN_SIMILARITY_THRESHOLD = 0.2;

async function generateEmbedding(text: string, openaiApiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-large",
        input: text,
        dimensions: 1536,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI embeddings error:", response.status, errText);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) {
    console.error("Embedding generation error:", e);
    return null;
  }
}

async function getOrCreateMiscKeyword(adminClient: any, userId: string, openaiApiKey: string): Promise<{ id: string; title: string }> {
  const { data: existing } = await adminClient
    .from("nodes")
    .select("id, title")
    .eq("creator_id", userId)
    .eq("type", "keyword")
    .eq("title", "기타")
    .limit(1);

  if (existing && existing.length > 0) {
    return { id: existing[0].id, title: existing[0].title };
  }

  const { data: created, error } = await adminClient
    .from("nodes")
    .insert({ title: "기타", creator_id: userId, type: "keyword" })
    .select("id, title")
    .single();

  if (error || !created) {
    console.error("Failed to create 기타 keyword:", error);
    throw new Error("Failed to create 기타 keyword");
  }

  const embedding = await generateEmbedding("기타", openaiApiKey);
  if (embedding) {
    await adminClient
      .from("nodes")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", created.id);
  }

  console.log(`Created "기타" keyword node: ${created.id}`);
  return { id: created.id, title: created.title };
}

/**
 * Use AI to generate a concise category caption from title + metadata.
 * This caption is then used for embedding, producing a much cleaner semantic signal.
 */
async function generateCategoryCaption(params: {
  title?: string;
  description?: string;
  content_type?: string;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    console.error("LOVABLE_API_KEY not configured, falling back to raw text");
    return null;
  }

  const meta = params.metadata || {};
  const contextParts: string[] = [];
  if (params.title) contextParts.push(`제목: ${params.title}`);
  const desc = (meta.description as string) || params.description || '';
  if (desc) contextParts.push(`설명: ${desc.slice(0, 500)}`);
  const keywords = meta.keywords as string[] | undefined;
  if (keywords?.length) contextParts.push(`태그: ${keywords.join(', ')}`);
  if (meta.author) contextParts.push(`저자/채널: ${meta.author}`);
  if (meta.category) contextParts.push(`카테고리: ${meta.category}`);
  if (meta.site_name) contextParts.push(`출처: ${meta.site_name}`);
  if (params.content_type) contextParts.push(`콘텐츠 유형: ${params.content_type}`);

  const context = contextParts.join('\n');

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a categorization expert. Given information about a piece of content, generate a detailed caption (3-5 sentences, 80-150 words) that thoroughly describes what category/topic this content belongs to. Include the main subject, related keywords, synonyms, and sub-topics so that semantic matching works well. Write in Korean. Be specific and expansive — e.g. "운동/헬스/피트니스 - 웨이트 트레이닝, 근력 운동, 이두근 삼두근 팔 운동법. 보디빌딩 및 체형 관리를 위한 헬스장 트레이닝 노하우. 관련 키워드: 헬스, 운동, 근육, 벌크업, 다이어트, 체력 단련" not just "운동 팁". The caption will be used to match this content to the right category via semantic similarity, so include as many relevant terms as possible.`,
          },
          {
            role: "user",
            content: context,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI caption generation error:", response.status, errText);
      return null;
    }

    const data = await response.json();
    const caption = data.choices?.[0]?.message?.content?.trim();
    console.log("AI caption:", caption);
    return caption || null;
  } catch (e) {
    console.error("Caption generation error:", e);
    return null;
  }
}

/**
 * Fallback: build embedding text directly from metadata when AI caption fails.
 */
function buildFallbackEmbeddingText(params: {
  title?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}): string {
  const parts: string[] = [];
  if (params.title) parts.push(params.title);
  const meta = params.metadata || {};
  const desc = (meta.description as string) || params.description || '';
  if (desc) parts.push(desc.slice(0, 300));
  const keywords = meta.keywords as string[] | undefined;
  if (keywords?.length) parts.push(keywords.join(', '));
  if (meta.category) parts.push(String(meta.category));
  if (meta.author) parts.push(String(meta.author));
  return parts.filter(Boolean).join(' | ');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { capture_id, title, description, content_type, content_url, metadata } = await req.json();

    if (!capture_id) {
      return new Response(JSON.stringify({ error: "capture_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Step 1: Generate AI category caption
    const aiCaption = await generateCategoryCaption({ title, description, content_type, metadata });

    // Step 2: Embed the caption (or fallback to raw metadata)
    const embeddingText = aiCaption || buildFallbackEmbeddingText({ title, description, metadata });
    console.log("Embedding text:", embeddingText.slice(0, 200));

    const embedding = await generateEmbedding(embeddingText, openaiApiKey);

    if (!embedding) {
      const misc = await getOrCreateMiscKeyword(adminClient, user.id, openaiApiKey);
      const fallbackUpdate: Record<string, unknown> = { connected_to: misc.id };
      if (metadata) fallbackUpdate.metadata = metadata;
      if (aiCaption) fallbackUpdate.ai_caption = aiCaption;
      await adminClient.from("captures").update(fallbackUpdate).eq("id", capture_id);

      return new Response(
        JSON.stringify({ keyword_id: misc.id, keyword_title: misc.title, reason: "no_embedding_fallback_misc", has_embedding: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find most similar node
    const { data: matchedNodes, error: matchError } = await adminClient.rpc("match_nodes", {
      query_embedding: JSON.stringify(embedding),
      match_threshold: 0.0,
      match_count: 1,
      user_id: user.id,
    });

    let selectedKeywordId: string | null = null;
    let selectedKeywordTitle = "";
    let reason = "";

    if (!matchError && matchedNodes && matchedNodes.length > 0) {
      const best = matchedNodes[0];
      const isEtcNode = best.title === "기타";

      if (!isEtcNode && best.similarity >= MIN_SIMILARITY_THRESHOLD) {
        selectedKeywordId = best.id;
        selectedKeywordTitle = best.title;
        reason = `embedding similarity: ${best.similarity.toFixed(3)}`;
        console.log(`Matched node "${best.title}" (${best.type}) with similarity ${best.similarity.toFixed(3)}`);
      } else {
        console.log(`Best match "${best.title}" similarity ${best.similarity.toFixed(3)} below threshold ${MIN_SIMILARITY_THRESHOLD}, assigning to 기타`);
        const misc = await getOrCreateMiscKeyword(adminClient, user.id, openaiApiKey);
        selectedKeywordId = misc.id;
        selectedKeywordTitle = misc.title;
        reason = `low_similarity_fallback (best: ${best.title} ${best.similarity.toFixed(3)})`;
      }
    } else {
      console.log("No node embeddings found, assigning to 기타");
      const misc = await getOrCreateMiscKeyword(adminClient, user.id, openaiApiKey);
      selectedKeywordId = misc.id;
      selectedKeywordTitle = misc.title;
      reason = "no_node_embeddings_fallback_misc";
    }

    // Update capture with keyword, embedding, metadata, and AI caption
    const updateData: Record<string, unknown> = { embedding: JSON.stringify(embedding) };
    if (selectedKeywordId) {
      updateData.connected_to = selectedKeywordId;
    }
    if (metadata) {
      updateData.metadata = metadata;
    }
    if (aiCaption) {
      updateData.ai_caption = aiCaption;
    }

    const { error: updateError } = await adminClient
      .from("captures")
      .update(updateData)
      .eq("id", capture_id)
      .eq("creator_id", user.id);

    if (updateError) {
      console.error("Failed to update capture:", updateError);
    }

    return new Response(
      JSON.stringify({
        keyword_id: selectedKeywordId,
        keyword_title: selectedKeywordTitle,
        reason,
        has_embedding: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("assign-capture-keyword error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
