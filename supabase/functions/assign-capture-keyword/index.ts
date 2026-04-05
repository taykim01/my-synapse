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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
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
    const { data: keywords, error: kwError } = await adminClient
      .from("nodes")
      .select("id, title")
      .eq("creator_id", user.id);

    if (kwError || !keywords || keywords.length === 0) {
      return new Response(JSON.stringify({ error: "No keywords found", keyword_id: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build capture context
    let captureContext = `제목: ${title || "(없음)"}`;
    if (description) captureContext += `\n메모: ${description}`;
    if (content_type) captureContext += `\n형식: ${content_type}`;
    if (content_url) captureContext += `\nURL: ${content_url}`;

    const keywordList = keywords.map((k) => `- ID: "${k.id}", 키워드: "${k.title}"`).join("\n");

    // Run AI keyword assignment and embedding generation in parallel
    const aiPromise = fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `당신은 캡처된 콘텐츠를 분석하여 가장 관련 있는 키워드를 선택하는 분류 전문가입니다.
유저의 키워드 목록과 캡처 내용을 비교하여 의미적으로 가장 관련이 깊은 키워드 하나를 선택하세요.
반드시 제공된 키워드 목록 중 하나의 ID를 선택해야 합니다.`,
          },
          {
            role: "user",
            content: `다음 캡처 내용을 분석하고, 아래 키워드 목록 중 가장 관련 있는 키워드를 선택해주세요.

## 캡처 내용
${captureContext}

## 키워드 목록
${keywordList}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "select_keyword",
              description: "캡처와 가장 관련 있는 키워드를 선택합니다.",
              parameters: {
                type: "object",
                properties: {
                  keyword_id: {
                    type: "string",
                    description: "선택된 키워드의 ID (UUID)",
                  },
                  reason: {
                    type: "string",
                    description: "선택 이유 (짧게)",
                  },
                },
                required: ["keyword_id", "reason"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "select_keyword" } },
      }),
    });

    // Generate embedding text from capture content
    const embeddingText = [title, description, content_url].filter(Boolean).join(" ");
    const embeddingPromise = openaiApiKey
      ? generateEmbedding(embeddingText, openaiApiKey)
      : Promise.resolve(null);

    const [aiResponse, embedding] = await Promise.all([aiPromise, embeddingPromise]);

    // Process AI keyword response
    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let selectedKeywordId: string | null = null;
    let reason = "";

    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        selectedKeywordId = args.keyword_id;
        reason = args.reason || "";
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    if (selectedKeywordId && !keywords.find((k) => k.id === selectedKeywordId)) {
      console.warn("AI selected invalid keyword, falling back to first");
      selectedKeywordId = keywords[0].id;
    }

    if (!selectedKeywordId) {
      selectedKeywordId = keywords[0].id;
    }

    // Update capture with keyword and embedding
    const updateData: Record<string, unknown> = { connected_to: selectedKeywordId };
    if (embedding) {
      updateData.embedding = JSON.stringify(embedding);
    }

    const { error: updateError } = await adminClient
      .from("captures")
      .update(updateData)
      .eq("id", capture_id)
      .eq("creator_id", user.id);

    if (updateError) {
      console.error("Failed to update capture:", updateError);
    }

    const selectedKeyword = keywords.find((k) => k.id === selectedKeywordId);

    return new Response(
      JSON.stringify({
        keyword_id: selectedKeywordId,
        keyword_title: selectedKeyword?.title || "",
        reason,
        has_embedding: !!embedding,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("assign-capture-keyword error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
