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
 * Use AI to generate related keywords for a node title.
 */
async function generateRelatedKeywords(title: string, pathContext: string): Promise<string | null> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) return null;

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
            content: `You are a keyword expansion expert. Given a category/topic name, generate 10-20 closely related Korean keywords that a typical person would associate with this topic. Include synonyms, sub-categories, related concepts, and commonly associated terms. Output ONLY a comma-separated list of keywords in Korean, nothing else. Example: input "헬스" → "운동, 피트니스, 웨이트 트레이닝, 근력 운동, 체력 단련, 벌크업, 다이어트, 헬스장, 짐, 보디빌딩, 근육, 유산소, 무산소, 스쿼트, 데드리프트, 벤치프레스, PT, 개인트레이닝, 체형관리"`,
          },
          {
            role: "user",
            content: pathContext !== title ? `카테고리: "${title}" (상위: "${pathContext}")` : `카테고리: "${title}"`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Related keywords generation error:", response.status, errText);
      return null;
    }

    const data = await response.json();
    const keywords = data.choices?.[0]?.message?.content?.trim();
    console.log(`Related keywords for "${title}": ${keywords?.slice(0, 100)}...`);
    return keywords || null;
  } catch (e) {
    console.error("Related keywords generation error:", e);
    return null;
  }
}

/**
 * Build a hierarchical path string.
 * For keywords: just the title.
 * For detailed_keywords: "ParentKeyword-DetailedKeyword" etc.
 */
async function buildEmbeddingPath(
  adminClient: any,
  node: { id: string; title: string; type: string; parent_id: string | null },
  userId: string,
): Promise<string> {
  if (node.type === "keyword" || !node.parent_id) {
    return node.title;
  }

  const pathParts: string[] = [node.title];
  let currentParentId: string | null = node.parent_id;
  const maxDepth = 10;

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

/**
 * Build the final embedding text.
 * Title is repeated 3x for higher weight, then related keywords are appended.
 */
function buildEmbeddingText(path: string, relatedKeywords: string | null): string {
  // Repeat the path for emphasis, then append related keywords
  const parts = [path, path, path];
  if (relatedKeywords) {
    parts.push(relatedKeywords);
  }
  return parts.join(" | ");
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

    // Get nodes with type, parent_id, and related_keywords
    const { data: nodes, error: fetchError } = await adminClient
      .from("nodes")
      .select("id, title, type, parent_id, related_keywords")
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
      const path = await buildEmbeddingPath(adminClient, node, user.id);

      // Generate related keywords if not already set
      let relatedKeywords = node.related_keywords;
      if (!relatedKeywords) {
        relatedKeywords = await generateRelatedKeywords(node.title, path);
        if (relatedKeywords) {
          await adminClient
            .from("nodes")
            .update({ related_keywords: relatedKeywords })
            .eq("id", node.id);
        }
      }

      const embeddingText = buildEmbeddingText(path, relatedKeywords);
      console.log(`Embedding text for "${node.title}" (${node.type}): "${embeddingText.slice(0, 150)}..."`);

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
