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
  // Check if "기타" keyword already exists for this user
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

  // Create "기타" keyword
  const { data: created, error } = await adminClient
    .from("nodes")
    .insert({ title: "기타", creator_id: userId, type: "keyword" })
    .select("id, title")
    .single();

  if (error || !created) {
    console.error("Failed to create 기타 keyword:", error);
    throw new Error("Failed to create 기타 keyword");
  }

  // Generate embedding for the new node
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { capture_id, title, description, content_type, content_url } = await req.json();

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

    // Generate embedding from capture content
    const embeddingText = [title, description, content_url].filter(Boolean).join(" ");
    const embedding = await generateEmbedding(embeddingText, openaiApiKey);

    if (!embedding) {
      // Fallback: no embedding, assign to "기타"
      const misc = await getOrCreateMiscKeyword(adminClient, user.id, openaiApiKey);
      await adminClient.from("captures").update({ connected_to: misc.id }).eq("id", capture_id);

      return new Response(
        JSON.stringify({ keyword_id: misc.id, keyword_title: misc.title, reason: "no_embedding_fallback_misc", has_embedding: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find most similar node using pgvector match_nodes function
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

      // Filter out "기타" from similarity matching — it should only be used as fallback
      const isEtcNode = best.title === "기타";

      if (!isEtcNode && best.similarity >= MIN_SIMILARITY_THRESHOLD) {
        selectedKeywordId = best.id;
        selectedKeywordTitle = best.title;
        reason = `embedding similarity: ${best.similarity.toFixed(3)}`;
        console.log(`Matched node "${best.title}" (${best.type}) with similarity ${best.similarity.toFixed(3)}`);
      } else {
        // Similarity too low or matched "기타" → assign to "기타"
        console.log(`Best match "${best.title}" similarity ${best.similarity.toFixed(3)} below threshold ${MIN_SIMILARITY_THRESHOLD}, assigning to 기타`);
        const misc = await getOrCreateMiscKeyword(adminClient, user.id, openaiApiKey);
        selectedKeywordId = misc.id;
        selectedKeywordTitle = misc.title;
        reason = `low_similarity_fallback (best: ${best.title} ${best.similarity.toFixed(3)})`;
      }
    } else {
      // No matching nodes at all → assign to "기타"
      console.log("No node embeddings found, assigning to 기타");
      const misc = await getOrCreateMiscKeyword(adminClient, user.id, openaiApiKey);
      selectedKeywordId = misc.id;
      selectedKeywordTitle = misc.title;
      reason = "no_node_embeddings_fallback_misc";
    }

    // Update capture with keyword and embedding
    const updateData: Record<string, unknown> = { embedding: JSON.stringify(embedding) };
    if (selectedKeywordId) {
      updateData.connected_to = selectedKeywordId;
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
