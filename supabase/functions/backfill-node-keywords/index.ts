import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function generateRelatedKeywords(title: string, path: string, lovableApiKey: string): Promise<string | null> {
  try {
    const prompt = path !== title ? `카테고리: "${title}" (상위: "${path}")` : `카테고리: "${title}"`;
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: 'You are a keyword expansion expert. Given a category/topic name, generate 10-20 closely related Korean keywords. Include synonyms, sub-categories, related concepts. Output ONLY a comma-separated list in Korean, nothing else.' },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) { console.error("AI error:", response.status); return null; }
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) { console.error("AI error:", e); return null; }
}

async function generateEmbedding(text: string, openaiApiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-large", input: text, dimensions: 1536 }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch { return null; }
}

function buildPath(node: any, allNodes: any[]): string {
  if (node.type === "keyword" || !node.parent_id) return node.title;
  const parts = [node.title];
  let pid = node.parent_id;
  for (let i = 0; i < 10 && pid; i++) {
    const parent = allNodes.find((n: any) => n.id === pid);
    if (!parent) break;
    parts.unshift(parent.title);
    pid = parent.type === "keyword" ? null : parent.parent_id;
  }
  return parts.join("-");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: nodes, error } = await adminClient
      .from("nodes")
      .select("id, title, type, parent_id, related_keywords, creator_id");

    if (error || !nodes) {
      return new Response(JSON.stringify({ error: "Failed to fetch nodes" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${nodes.length} nodes...`);
    let success = 0;
    let failed = 0;

    for (const node of nodes) {
      const path = buildPath(node, nodes);
      let rk = node.related_keywords;

      if (!rk) {
        rk = await generateRelatedKeywords(node.title, path, lovableApiKey);
        if (rk) {
          await adminClient.from("nodes").update({ related_keywords: rk }).eq("id", node.id);
          console.log(`RK for "${node.title}": ${rk.slice(0, 80)}...`);
        }
      }

      const embedText = rk ? `${path} | ${path} | ${path} | ${rk}` : `${path} | ${path} | ${path}`;
      const embedding = await generateEmbedding(embedText, openaiApiKey);

      if (embedding) {
        await adminClient.from("nodes").update({ embedding: JSON.stringify(embedding) }).eq("id", node.id);
        success++;
        console.log(`[${success + failed}/${nodes.length}] ✓ ${node.title} (${node.type})`);
      } else {
        failed++;
        console.log(`[${success + failed}/${nodes.length}] ✗ ${node.title}`);
      }
    }

    console.log(`Done: ${success} success, ${failed} failed out of ${nodes.length}`);
    return new Response(
      JSON.stringify({ success, failed, total: nodes.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("backfill error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
