const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function encodeBase64Chunked(bytes: Uint8Array): string {
  let binaryStr = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binaryStr += String.fromCharCode(...chunk);
  }
  return btoa(binaryStr);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_url, file_name } = await req.json();

    if (!file_url) {
      return new Response(JSON.stringify({ error: "file_url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch file to determine type and extract content
    const fileResp = await fetch(file_url);
    if (!fileResp.ok) {
      throw new Error(`Failed to fetch file: ${fileResp.status}`);
    }

    const contentType = fileResp.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await fileResp.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Limit to 1MB for processing
    const maxBytes = 1 * 1024 * 1024;
    const truncated = bytes.length > maxBytes ? bytes.slice(0, maxBytes) : bytes;

    const isTextBased = contentType.includes("text") ||
      contentType.includes("json") ||
      contentType.includes("xml") ||
      contentType.includes("csv") ||
      contentType.includes("javascript") ||
      contentType.includes("markdown");

    const isImage = contentType.startsWith("image/");

    let content: any[];

    if (isTextBased) {
      // Text files: extract content directly
      const textContent = new TextDecoder().decode(truncated).slice(0, 5000);
      content = [
        {
          type: "text",
          text: `파일명: ${file_name || "unknown"}\n파일 내용 (일부):\n${textContent}\n\n이 파일에 적합한 제목을 생성해주세요.`,
        },
      ];
    } else if (isImage) {
      // Images: send as base64 data URI via image_url
      const base64 = encodeBase64Chunked(truncated);
      content = [
        {
          type: "image_url",
          image_url: { url: `data:${contentType};base64,${base64}` },
        },
        {
          type: "text",
          text: `파일명: ${file_name || "unknown"}\n이 이미지에 적합한 제목을 생성해주세요.`,
        },
      ];
    } else {
      // PDFs, docs, and other binary files: use filename + metadata only
      // (image_url type doesn't support non-image mimetypes)
      const ext = (file_name || "").split(".").pop()?.toLowerCase() || "";
      content = [
        {
          type: "text",
          text: `파일명: ${file_name || "unknown"}\nMIME 타입: ${contentType}\n확장자: ${ext}\n파일 크기: ${bytes.length} bytes\n\n파일명과 메타데이터를 바탕으로 이 파일에 적합한 한국어 제목을 생성해주세요.`,
        },
      ];
    }

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
            content: "파일을 분석하여 간결한 한국어 제목을 하나 생성하세요. 제목만 출력하세요. 15자 이내로 작성하세요.",
          },
          { role: "user", content },
        ],
        max_tokens: 60,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const title = aiData.choices?.[0]?.message?.content?.trim() || "";

    return new Response(
      JSON.stringify({ title }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-file-title error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
