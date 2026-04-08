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
      console.error("OpenAI embeddings error:", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) {
    console.error("Embedding generation error:", e);
    return null;
  }
}

async function generateCategoryCaption(params: {
  title?: string;
  description?: string;
  content_type?: string;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) return null;

  const meta = params.metadata || {};
  const contextParts: string[] = [];
  if (params.title) contextParts.push(`제목: ${params.title}`);
  const desc = (meta.description as string) || params.description || '';
  if (desc) contextParts.push(`설명: ${desc.slice(0, 500)}`);
  const keywords = meta.keywords as string[] | undefined;
  if (keywords?.length) contextParts.push(`태그: ${keywords.join(', ')}`);
  if (meta.author) contextParts.push(`저자/채널: ${meta.author}`);
  if (meta.category) contextParts.push(`카테고리: ${meta.category}`);
  if (meta.site_name) contextParts.push(`출처: ${meta.site_name}`);
  if (params.content_type) contextParts.push(`콘텐츠 유형: ${params.content_type}`);
  if (params.description) contextParts.push(`사용자 메모: ${params.description.slice(0, 300)}`);

  const context = contextParts.join('\n');
  if (!context.trim()) return null;

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
            content: `You are a categorization expert. Given information about a piece of content, generate a short caption (1-2 sentences, max 50 words) that describes what category/topic this content belongs to. Focus on the subject matter, theme, and domain. Write in Korean. Be specific — e.g. "한국 역사 다큐멘터리 - 조선시대 궁궐 건축과 온돌 시스템" not just "역사". The caption will be used to match this content to the right category via semantic similarity.`,
          },
          { role: "user", content: context },
        ],
      }),
    });
    if (!response.ok) {
      console.error("AI caption error:", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    const caption = data.choices?.[0]?.message?.content?.trim();
    console.log("Regenerated AI caption:", caption);
    return caption || null;
  } catch (e) {
    console.error("Caption generation error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { capture_id, title, description } = await req.json();
    if (!capture_id) {
      return new Response(JSON.stringify({ error: "capture_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

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

    // Fetch full capture data (including metadata for ai_caption regeneration)
    const { data: capture } = await adminClient
      .from("captures")
      .select("id, creator_id, title, description, content_type, metadata")
      .eq("id", capture_id)
      .single();

    if (!capture || capture.creator_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not found or unauthorized" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Merge updated fields
    const finalTitle = title !== undefined ? title : capture.title;
    const finalDescription = description !== undefined ? description : capture.description;

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = finalTitle;
    if (description !== undefined) updates.description = finalDescription;

    // Regenerate ai_caption using title + metadata + description
    const aiCaption = await generateCategoryCaption({
      title: finalTitle,
      description: finalDescription || undefined,
      content_type: capture.content_type,
      metadata: capture.metadata as Record<string, unknown> | undefined,
    });

    if (aiCaption) {
      updates.ai_caption = aiCaption;
    }

    // Regenerate embedding from ai_caption (or fallback)
    if (openaiApiKey) {
      const embeddingText = aiCaption || [finalTitle, finalDescription].filter(Boolean).join(" ");
      if (embeddingText.trim()) {
        const embedding = await generateEmbedding(embeddingText, openaiApiKey);
        if (embedding) {
          updates.embedding = JSON.stringify(embedding);
          console.log("Embedding regenerated from:", embeddingText.slice(0, 100));
        }
      }
    }

    const { error: updateError } = await adminClient
      .from("captures")
      .update(updates)
      .eq("id", capture_id);

    if (updateError) throw new Error(updateError.message);

    return new Response(JSON.stringify({ success: true, ai_caption: aiCaption || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("update-capture error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
