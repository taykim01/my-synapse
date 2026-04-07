import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MIN_SIMILARITY_THRESHOLD = 0.4;

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
 * Build an optimized string for embedding generation.
 * Prioritizes: title, description, keywords/tags, category, author, site context.
 * Keeps it concise but semantically rich.
 */
function buildEmbeddingText(params: {
  title?: string;
  description?: string;
  content_type?: string;
  content_url?: string;
  metadata?: Record<string, unknown>;
}): string {
  const parts: string[] = [];

  // Title is the strongest signal
  if (params.title) {
    parts.push(params.title);
  }

  const meta = params.metadata || {};

  // Description adds context (truncate to ~300 chars to avoid noise)
  const desc = (meta.description as string) || params.description || '';
  if (desc) {
    parts.push(desc.slice(0, 300));
  }

  // Keywords/tags are highly relevant for categorization
  const keywords = meta.keywords as string[] | undefined;
  if (keywords && keywords.length > 0) {
    parts.push(keywords.join(', '));
  }

  // Category directly helps classification
  if (meta.category) {
    parts.push(`카테고리: ${meta.category}`);
  }

  // Author/channel provides context (e.g. music channel → music)
  if (meta.author) {
    parts.push(`${meta.author}`);
  }

  // Site name provides domain context
  if (meta.site_name) {
    parts.push(`${meta.site_name}`);
  }

  // Content type as context
  if (meta.type) {
    parts.push(`${meta.type}`);
  }

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

    // Build optimized embedding text from all available data
    const embeddingText = buildEmbeddingText({ title, description, content_type, content_url, metadata });
    console.log("Embedding text:", embeddingText.slice(0, 200));

    const embedding = await generateEmbedding(embeddingText, openaiApiKey);

    if (!embedding) {
      const misc = await getOrCreateMiscKeyword(adminClient, user.id, openaiApiKey);
      // Save metadata even on fallback
      const fallbackUpdate: Record<string, unknown> = { connected_to: misc.id };
      if (metadata) fallbackUpdate.metadata = metadata;
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

    // Update capture with keyword, embedding, and metadata
    const updateData: Record<string, unknown> = { embedding: JSON.stringify(embedding) };
    if (selectedKeywordId) {
      updateData.connected_to = selectedKeywordId;
    }
    if (metadata) {
      updateData.metadata = metadata;
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
