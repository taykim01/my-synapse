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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    let capturesProcessed = 0, capturesFailed = 0, capturesTotal = 0;
    let nodesProcessed = 0, nodesFailed = 0, nodesTotal = 0;

    // 1. Backfill capture embeddings
    const { data: captures } = await adminClient
      .from("captures")
      .select("id, title, description, content_url")
      .eq("creator_id", user.id)
      .is("embedding", null);

    if (captures && captures.length > 0) {
      capturesTotal = captures.length;
      console.log(`Found ${capturesTotal} captures without embeddings`);

      for (let i = 0; i < captures.length; i += 5) {
        const batch = captures.slice(i, i + 5);
        await Promise.all(
          batch.map(async (capture) => {
            const text = [capture.title, capture.description, capture.content_url].filter(Boolean).join(" ");
            const embedding = await generateEmbedding(text, openaiApiKey);
            if (!embedding) { capturesFailed++; return; }
            const { error } = await adminClient.from("captures").update({ embedding: JSON.stringify(embedding) }).eq("id", capture.id);
            if (error) { capturesFailed++; } else { capturesProcessed++; }
          })
        );
      }
    }

    // 2. Backfill node embeddings
    const { data: nodes } = await adminClient
      .from("nodes")
      .select("id, title")
      .eq("creator_id", user.id)
      .is("embedding", null);

    if (nodes && nodes.length > 0) {
      nodesTotal = nodes.length;
      console.log(`Found ${nodesTotal} nodes without embeddings`);

      for (let i = 0; i < nodes.length; i += 5) {
        const batch = nodes.slice(i, i + 5);
        await Promise.all(
          batch.map(async (node) => {
            const embedding = await generateEmbedding(node.title, openaiApiKey);
            if (!embedding) { nodesFailed++; return; }
            const { error } = await adminClient.from("nodes").update({ embedding: JSON.stringify(embedding) }).eq("id", node.id);
            if (error) { nodesFailed++; } else { nodesProcessed++; }
          })
        );
      }
    }

    console.log(`Backfill complete: captures ${capturesProcessed}/${capturesTotal}, nodes ${nodesProcessed}/${nodesTotal}`);

    return new Response(
      JSON.stringify({
        processed: capturesProcessed + nodesProcessed,
        failed: capturesFailed + nodesFailed,
        total: capturesTotal + nodesTotal,
        captures: { processed: capturesProcessed, failed: capturesFailed, total: capturesTotal },
        nodes: { processed: nodesProcessed, failed: nodesFailed, total: nodesTotal },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("backfill-embeddings error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
