import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { capture_id, node_id, threshold } = await req.json();
    const mu = threshold ?? 0.3;

    if (!capture_id || !node_id) {
      return new Response(JSON.stringify({ error: "capture_id and node_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

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

    // Get the new capture's embedding
    const { data: newCapture } = await adminClient
      .from("captures")
      .select("id, title, description, embedding")
      .eq("id", capture_id)
      .single();

    if (!newCapture?.embedding) {
      console.log("New capture has no embedding, skipping similarity check");
      return new Response(JSON.stringify({ created: false, reason: "no_embedding" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newEmbedding: number[] = JSON.parse(newCapture.embedding);

    // Get all sibling captures under the same node (excluding the new one)
    const { data: siblings } = await adminClient
      .from("captures")
      .select("id, title, description, embedding")
      .eq("connected_to", node_id)
      .eq("creator_id", user.id)
      .neq("id", capture_id);

    if (!siblings || siblings.length === 0) {
      return new Response(JSON.stringify({ created: false, reason: "no_siblings" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find captures with similarity below threshold
    const lowSimCaptures: { id: string; title: string; description: string | null; similarity: number }[] = [];
    for (const sib of siblings) {
      if (!sib.embedding) continue;
      const sibEmbedding: number[] = JSON.parse(sib.embedding);
      const sim = cosineSimilarity(newEmbedding, sibEmbedding);
      if (sim <= mu) {
        lowSimCaptures.push({ id: sib.id, title: sib.title, description: sib.description, similarity: sim });
      }
    }

    if (lowSimCaptures.length === 0) {
      return new Response(JSON.stringify({ created: false, reason: "all_similar" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${lowSimCaptures.length} captures below threshold ${mu}`);

    // Get parent node info
    const { data: parentNode } = await adminClient
      .from("nodes")
      .select("id, title, type, parent_id")
      .eq("id", node_id)
      .single();

    if (!parentNode) {
      return new Response(JSON.stringify({ created: false, reason: "node_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI to generate a name for the new DetailedKeyword
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ created: false, reason: "no_ai_key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const captureContext = `새 캡처: "${newCapture.title}"${newCapture.description ? ` - ${newCapture.description}` : ""}`;
    const siblingContext = lowSimCaptures
      .slice(0, 5)
      .map(c => `"${c.title}"${c.description ? ` - ${c.description}` : ""} (유사도: ${c.similarity.toFixed(3)})`)
      .join("\n");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `당신은 지식 그래프의 세부 키워드를 생성하는 전문가입니다.
상위 키워드 아래에서 유사도가 낮은 캡처들을 분리하기 위한 새로운 세부 키워드 이름을 생성합니다.
키워드는 2~4단어로 간결하게 만들어야 합니다.
또한 새 캡처를 새 세부 키워드로 이동해야 하는지, 아니면 저유사도 캡처들을 이동해야 하는지 판단합니다.`,
          },
          {
            role: "user",
            content: `상위 키워드: "${parentNode.title}"

${captureContext}

유사도가 낮은 기존 캡처들:
${siblingContext}

새 캡처와 위 캡처들의 유사도가 낮습니다. 
이들을 분리하기 위한 새로운 세부 키워드를 제안해주세요.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_detailed_keyword",
              description: "새 세부 키워드를 생성하고 캡처를 재배치합니다.",
              parameters: {
                type: "object",
                properties: {
                  keyword_name: {
                    type: "string",
                    description: "새 세부 키워드 이름 (2~4단어)",
                  },
                  move_captures: {
                    type: "string",
                    enum: ["new_capture", "low_sim_captures"],
                    description: "new_capture: 새 캡처를 이동, low_sim_captures: 유사도 낮은 기존 캡처들을 이동",
                  },
                  reason: {
                    type: "string",
                    description: "분류 이유",
                  },
                },
                required: ["keyword_name", "move_captures", "reason"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_detailed_keyword" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ created: false, reason: "ai_error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ created: false, reason: "ai_no_result" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const args = JSON.parse(toolCall.function.arguments);
    const { keyword_name, move_captures, reason } = args;

    console.log(`Creating DetailedKeyword: "${keyword_name}" under "${parentNode.title}", move: ${move_captures}, reason: ${reason}`);

    // Create the new DetailedKeyword node
    const { data: newNode, error: insertError } = await adminClient
      .from("nodes")
      .insert({
        title: keyword_name,
        type: "detailed_keyword",
        parent_id: node_id,
        creator_id: user.id,
      })
      .select()
      .single();

    if (insertError || !newNode) {
      console.error("Failed to create detailed keyword:", insertError);
      return new Response(JSON.stringify({ created: false, reason: "insert_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Move captures to the new DetailedKeyword
    const captureIdsToMove = move_captures === "new_capture"
      ? [capture_id]
      : lowSimCaptures.map(c => c.id);

    const { error: moveError } = await adminClient
      .from("captures")
      .update({ connected_to: newNode.id })
      .in("id", captureIdsToMove);

    if (moveError) {
      console.error("Failed to move captures:", moveError);
    }

    console.log(`Moved ${captureIdsToMove.length} captures to "${keyword_name}" (${newNode.id})`);

    return new Response(
      JSON.stringify({
        created: true,
        detailed_keyword: {
          id: newNode.id,
          title: keyword_name,
          type: "detailed_keyword",
          parent_id: node_id,
        },
        moved_capture_ids: captureIdsToMove,
        move_type: move_captures,
        reason,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-capture-similarity error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
