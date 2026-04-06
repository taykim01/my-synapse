import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateEmbedding(text: string, openaiApiKey: string): Promise<number[] | null> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text, dimensions: 1536 }),
  });
  if (!response.ok) {
    console.error("Embedding error:", await response.text());
    return null;
  }
  const data = await response.json();
  return data.data?.[0]?.embedding || null;
}

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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const userId = "785a217d-d30a-48e1-8fbf-0c85f726852e";
    const nodeId = "5355cd54-374f-4ab2-b498-26718a186a1a"; // 인공지능

    // Step 1: Get captures without embeddings
    const { data: captures } = await adminClient
      .from("captures")
      .select("id, title, description, embedding")
      .eq("connected_to", nodeId)
      .eq("creator_id", userId);

    if (!captures || captures.length === 0) {
      return new Response(JSON.stringify({ error: "No captures found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${captures.length} captures under 인공지능`);

    // Step 2: Generate embeddings for captures that don't have them
    const results: { id: string; title: string; has_embedding: boolean }[] = [];
    const embeddings: Map<string, number[]> = new Map();

    for (const cap of captures) {
      if (cap.embedding) {
        embeddings.set(cap.id, JSON.parse(cap.embedding));
        results.push({ id: cap.id, title: cap.title, has_embedding: true });
        continue;
      }

      const text = `${cap.title} ${cap.description || ""}`;
      console.log(`Generating embedding for: ${cap.title}`);
      const emb = await generateEmbedding(text, openaiApiKey);
      if (emb) {
        await adminClient
          .from("captures")
          .update({ embedding: JSON.stringify(emb) })
          .eq("id", cap.id);
        embeddings.set(cap.id, emb);
        results.push({ id: cap.id, title: cap.title, has_embedding: true });
      } else {
        results.push({ id: cap.id, title: cap.title, has_embedding: false });
      }
    }

    // Step 3: Calculate pairwise similarities
    const similarities: { a: string; b: string; sim: number }[] = [];
    const ids = Array.from(embeddings.keys());
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const sim = cosineSimilarity(embeddings.get(ids[i])!, embeddings.get(ids[j])!);
        const capA = captures.find(c => c.id === ids[i])!;
        const capB = captures.find(c => c.id === ids[j])!;
        similarities.push({ a: capA.title, b: capB.title, sim: Math.round(sim * 1000) / 1000 });
      }
    }

    console.log("Pairwise similarities:", JSON.stringify(similarities, null, 2));

    // Step 4: Now call check-capture-similarity for the last capture
    const lastCapture = captures[captures.length - 1];
    console.log(`\nCalling check-capture-similarity for: "${lastCapture.title}" (${lastCapture.id})`);

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Simulate what check-capture-similarity does
    const newEmbedding = embeddings.get(lastCapture.id);
    if (!newEmbedding) {
      return new Response(JSON.stringify({ error: "Last capture has no embedding", results, similarities }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const threshold = 0.3;
    const lowSimCaptures: { id: string; title: string; similarity: number }[] = [];
    for (const cap of captures) {
      if (cap.id === lastCapture.id) continue;
      const sibEmb = embeddings.get(cap.id);
      if (!sibEmb) continue;
      const sim = cosineSimilarity(newEmbedding, sibEmb);
      if (sim <= threshold) {
        lowSimCaptures.push({ id: cap.id, title: cap.title, similarity: Math.round(sim * 1000) / 1000 });
      }
    }

    console.log(`Low similarity captures (≤${threshold}):`, lowSimCaptures);

    // Step 5: If there are low similarity captures, create a DetailedKeyword via AI
    let detailedKeywordResult = null;
    if (lowSimCaptures.length > 0 && lovableApiKey) {
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
              content: `당신은 지식 그래프의 세부 키워드를 생성하는 전문가입니다. 2~4단어로 간결한 키워드를 만들어야 합니다.`,
            },
            {
              role: "user",
              content: `상위 키워드: "인공지능"
새 캡처: "${lastCapture.title}"
유사도가 낮은 기존 캡처들:
${lowSimCaptures.map(c => `"${c.title}" (유사도: ${c.similarity})`).join("\n")}

새 세부 키워드를 제안해주세요.`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_detailed_keyword",
                parameters: {
                  type: "object",
                  properties: {
                    keyword_name: { type: "string" },
                    move_captures: { type: "string", enum: ["new_capture", "low_sim_captures"] },
                    reason: { type: "string" },
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

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          const args = JSON.parse(toolCall.function.arguments);
          console.log("AI suggested:", args);

          // Create the DetailedKeyword node
          const { data: newNode, error: insertErr } = await adminClient
            .from("nodes")
            .insert({
              title: args.keyword_name,
              type: "detailed_keyword",
              parent_id: nodeId,
              creator_id: userId,
            })
            .select()
            .single();

          if (newNode) {
            // Move captures
            const captureIdsToMove = args.move_captures === "new_capture"
              ? [lastCapture.id]
              : lowSimCaptures.map(c => c.id);

            await adminClient
              .from("captures")
              .update({ connected_to: newNode.id })
              .in("id", captureIdsToMove);

            detailedKeywordResult = {
              node: newNode,
              moved: captureIdsToMove.length,
              move_type: args.move_captures,
              reason: args.reason,
            };
            console.log(`Created DetailedKeyword: "${args.keyword_name}", moved ${captureIdsToMove.length} captures`);
          } else {
            console.error("Insert error:", insertErr);
          }
        }
      } else {
        console.error("AI error:", await aiResponse.text());
      }
    }

    return new Response(JSON.stringify({
      captures: results,
      similarities,
      low_similarity_captures: lowSimCaptures,
      threshold,
      detailed_keyword_created: detailedKeywordResult,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
