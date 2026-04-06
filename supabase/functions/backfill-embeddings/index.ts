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

    // Auth check
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

    // Find captures without embeddings for this user
    const { data: captures, error: fetchError } = await adminClient
      .from("captures")
      .select("id, title, description, content_url")
      .eq("creator_id", user.id)
      .is("embedding", null);

    if (fetchError) {
      throw new Error(`Failed to fetch captures: ${fetchError.message}`);
    }

    if (!captures || captures.length === 0) {
      return new Response(JSON.stringify({ message: "No captures need embeddings", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${captures.length} captures without embeddings`);

    let processed = 0;
    let failed = 0;

    // Process in batches of 5 to avoid rate limits
    for (let i = 0; i < captures.length; i += 5) {
      const batch = captures.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(async (capture) => {
          const text = [capture.title, capture.description, capture.content_url]
            .filter(Boolean)
            .join(" ");

          const embedding = await generateEmbedding(text, openaiApiKey);
          if (!embedding) {
            failed++;
            return null;
          }

          const { error: updateError } = await adminClient
            .from("captures")
            .update({ embedding: JSON.stringify(embedding) })
            .eq("id", capture.id);

          if (updateError) {
            console.error(`Failed to update capture ${capture.id}:`, updateError);
            failed++;
            return null;
          }

          processed++;
          console.log(`Embedded: ${capture.title} (${capture.id})`);
          return capture.id;
        })
      );
    }

    console.log(`Backfill complete: ${processed} processed, ${failed} failed`);

    return new Response(
      JSON.stringify({ processed, failed, total: captures.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("backfill-embeddings error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
