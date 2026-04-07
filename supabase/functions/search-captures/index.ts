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
    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ text_results: [], semantic_results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    // Get user
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

    // Run text search and embedding generation in parallel
    const textSearchPromise = adminClient.rpc("search_captures", {
      search_query: query.trim(),
      user_id: user.id,
    });

    const embeddingPromise = openaiApiKey
      ? generateEmbedding(query.trim(), openaiApiKey)
      : Promise.resolve(null);

    const [{ data: textResults, error: textError }, queryEmbedding] = await Promise.all([
      textSearchPromise,
      embeddingPromise,
    ]);

    if (textError) {
      console.error("Text search error:", textError);
    }

    // Semantic search if embedding was generated
    let semanticResults: unknown[] = [];
    if (queryEmbedding) {
      console.log("Query embedding generated, length:", queryEmbedding.length);
      try {
        const embeddingStr = `[${queryEmbedding.join(",")}]`;
        const { data: matchData, error: matchError } = await adminClient.rpc("match_captures", {
          query_embedding: embeddingStr,
          user_id: user.id,
          match_threshold: 0.2,
          match_count: 10,
        });
        if (matchError) {
          console.error("Semantic search error:", matchError);
        } else {
          console.log("Semantic results count:", matchData?.length || 0);
          if (matchData) {
            matchData.forEach((m: { id: string; title: string; similarity: number }) => {
              console.log(`  - [${m.similarity.toFixed(4)}] ${m.title} (${m.id})`);
            });
          }
          semanticResults = matchData || [];
        }
      } catch (e) {
        console.error("Semantic search error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        text_results: textResults || [],
        semantic_results: semanticResults,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("search-captures error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
