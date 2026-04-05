import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

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

    // 1. Text search via RPC
    const textSearchPromise = adminClient.rpc("search_captures", {
      search_query: query.trim(),
      user_id: user.id,
    });

    // 2. Semantic search: generate embedding then match
    let semanticResults: any[] = [];
    if (lovableApiKey) {
      try {
        // Generate embedding for query using AI
        const embeddingResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You are an embedding generator. Given a search query, output ONLY a JSON array of 1536 floating-point numbers representing a semantic embedding vector. No explanation, no markdown, just the raw JSON array.`,
              },
              {
                role: "user",
                content: `Generate a 1536-dimensional embedding vector for this search query: "${query.trim()}"`,
              },
            ],
            temperature: 0,
          }),
        });

        if (embeddingResponse.ok) {
          const embData = await embeddingResponse.json();
          const content = embData.choices?.[0]?.message?.content || "";
          
          // Try to parse the embedding array
          const match = content.match(/\[[\s\S]*\]/);
          if (match) {
            const embedding = JSON.parse(match[0]);
            if (Array.isArray(embedding) && embedding.length === 1536) {
              const embeddingStr = `[${embedding.join(",")}]`;
              const { data: matchData } = await adminClient.rpc("match_captures", {
                query_embedding: embeddingStr,
                user_id: user.id,
                match_threshold: 0.5,
                match_count: 10,
              });
              if (matchData) {
                semanticResults = matchData;
              }
            }
          }
        }
      } catch (e) {
        console.error("Semantic search error:", e);
      }
    }

    const { data: textResults, error: textError } = await textSearchPromise;
    if (textError) {
      console.error("Text search error:", textError);
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
