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

/**
 * Build a hierarchical path string for embedding.
 * For keywords: just the title.
 * For detailed_keywords: "ParentKeyword-DetailedKeyword" or "ParentKeyword-ParentDK-DetailedKeyword"
 */
async function buildEmbeddingPath(
  adminClient: any,
  node: { id: string; title: string; type: string; parent_id: string | null },
  userId: string,
): Promise<string> {
  if (node.type === "keyword" || !node.parent_id) {
    return node.title;
  }

  // Build path by traversing up the parent chain
  const pathParts: string[] = [node.title];
  let currentParentId: string | null = node.parent_id;
  const maxDepth = 10; // safety limit

  for (let i = 0; i < maxDepth && currentParentId; i++) {
    const { data: parent } = await adminClient
      .from("nodes")
      .select("id, title, type, parent_id")
      .eq("id", currentParentId)
      .eq("creator_id", userId)
      .single();

    if (!parent) break;
    pathParts.unshift(parent.title);
    currentParentId = parent.type === "keyword" ? null : parent.parent_id;
  }

  return pathParts.join("-");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { node_ids } = await req.json();

    if (!node_ids || !Array.isArray(node_ids) || node_ids.length === 0) {
      return new Response(JSON.stringify({ error: "node_ids array is required" }), {
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

    // Get nodes with type and parent_id
    const { data: nodes, error: fetchError } = await adminClient
      .from("nodes")
      .select("id, title, type, parent_id")
      .in("id", node_ids)
      .eq("creator_id", user.id);

    if (fetchError || !nodes || nodes.length === 0) {
      return new Response(JSON.stringify({ error: "No nodes found", processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let failed = 0;

    for (const node of nodes) {
      const embeddingText = await buildEmbeddingPath(adminClient, node, user.id);
      console.log(`Embedding text for "${node.title}" (${node.type}): "${embeddingText}"`);

      const embedding = await generateEmbedding(embeddingText, openaiApiKey);
      if (embedding) {
        const { error: updateError } = await adminClient
          .from("nodes")
          .update({ embedding: JSON.stringify(embedding) })
          .eq("id", node.id);

        if (updateError) {
          console.error(`Failed to update node ${node.id}:`, updateError);
          failed++;
        } else {
          processed++;
        }
      } else {
        failed++;
      }
    }

    console.log(`Generated embeddings: ${processed} success, ${failed} failed out of ${nodes.length}`);

    return new Response(
      JSON.stringify({ processed, failed, total: nodes.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-node-embeddings error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
