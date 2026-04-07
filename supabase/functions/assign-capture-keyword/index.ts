import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function generateEmbedding(text: string, openaiApiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
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
      // Fallback: no embedding, pick first keyword
      const { data: keywords } = await adminClient
        .from("nodes")
        .select("id, title")
        .eq("creator_id", user.id)
        .eq("type", "keyword")
        .limit(1);

      const fallbackId = keywords?.[0]?.id || null;
      if (fallbackId) {
        await adminClient.from("captures").update({ connected_to: fallbackId }).eq("id", capture_id);
      }

      return new Response(
        JSON.stringify({ keyword_id: fallbackId, keyword_title: keywords?.[0]?.title || "", reason: "no_embedding_fallback", has_embedding: false }),
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
      selectedKeywordId = best.id;
      selectedKeywordTitle = best.title;
      reason = `embedding similarity: ${best.similarity.toFixed(3)}`;
      console.log(`Matched node "${best.title}" (${best.type}) with similarity ${best.similarity.toFixed(3)}`);
    } else {
      // Fallback: no matching nodes (maybe no node embeddings yet), pick first keyword
      console.log("No node embeddings found, falling back to first keyword");
      const { data: keywords } = await adminClient
        .from("nodes")
        .select("id, title")
        .eq("creator_id", user.id)
        .eq("type", "keyword")
        .limit(1);

      if (keywords && keywords.length > 0) {
        selectedKeywordId = keywords[0].id;
        selectedKeywordTitle = keywords[0].title;
        reason = "fallback_no_node_embeddings";
      }
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
