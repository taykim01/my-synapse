const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Fetch the file and convert to base64
    const fileResp = await fetch(file_url);
    if (!fileResp.ok) {
      throw new Error(`Failed to fetch file: ${fileResp.status}`);
    }

    const contentType = fileResp.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await fileResp.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // For very large files, only use first 2MB to avoid token limits
    const maxBytes = 2 * 1024 * 1024;
    const truncated = bytes.length > maxBytes ? bytes.slice(0, maxBytes) : bytes;

    // Try text extraction for text-based files
    const isTextBased = contentType.includes("text") ||
      contentType.includes("json") ||
      contentType.includes("xml") ||
      contentType.includes("csv") ||
      contentType.includes("javascript") ||
      contentType.includes("markdown");

    let content: any[];

    if (isTextBased) {
      const textContent = new TextDecoder().decode(truncated).slice(0, 5000);
      content = [
        {
          type: "text",
          text: `파일명: ${file_name || "unknown"}\n파일 내용 (일부):\n${textContent}\n\n이 파일에 적합한 제목을 생성해주세요.`,
        },
      ];
    } else {
      // For binary files — chunk-safe base64 encoding (avoids stack overflow with spread)
      let binaryStr = "";
      const chunkSize = 8192;
      for (let i = 0; i < truncated.length; i += chunkSize) {
        const chunk = truncated.subarray(i, i + chunkSize);
        binaryStr += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binaryStr);

      // Determine if the model can handle this mime type
      const supportedMimes = [
        "application/pdf",
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "audio/mpeg", "audio/wav", "audio/ogg",
        "video/mp4", "video/mpeg",
      ];

      const mimeSupported = supportedMimes.some(m => contentType.startsWith(m));

      if (mimeSupported) {
        content = [
          {
            type: "image_url",
            image_url: {
              url: `data:${contentType};base64,${base64}`,
            },
          },
          {
            type: "text",
            text: `파일명: ${file_name || "unknown"}\n이 파일의 내용을 파악하고 적합한 제목을 생성해주세요.`,
          },
        ];
      } else {
        // Unsupported binary format - use filename only
        content = [
          {
            type: "text",
            text: `파일명: ${file_name || "unknown"}\nMIME 타입: ${contentType}\n이 파일에 적합한 제목을 생성해주세요.`,
          },
        ];
      }
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
          {
            role: "user",
            content,
          },
        ],
        max_tokens: 60,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
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
