import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";

export default function Share() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const processed = useRef(false);
  const [status, setStatus] = useState("준비 중...");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }
    if (processed.current) return;
    processed.current = true;

    const title = searchParams.get("title") || "";
    const text = searchParams.get("text") || "";
    const url = searchParams.get("url") || "";

    const sharedUrl = url || extractUrl(text) || "";
    const sharedTitle = title || text.slice(0, 100) || "";
    const isLink = !!sharedUrl;

    const processCapture = async () => {
      try {
        // Step 1: Fetch metadata if it's a link
        let metadata: Record<string, unknown> | null = null;
        let resolvedTitle = sharedTitle;

        if (isLink) {
          setStatus("메타데이터 가져오는 중...");
          try {
            const { data, error } = await supabase.functions.invoke("fetch-url-metadata", {
              body: { url: sharedUrl },
            });
            if (!error && data) {
              resolvedTitle = data.title || resolvedTitle || extractDomain(sharedUrl);
              const { title: _t, thumbnail: _th, ...rest } = data;
              metadata = rest as Record<string, unknown>;
            }
          } catch (e) {
            console.error("Metadata fetch failed:", e);
          }
        }

        if (!resolvedTitle) {
          resolvedTitle = isLink ? extractDomain(sharedUrl) : "공유된 캡처";
        }

        // Build metadata for text type if not a link
        if (!isLink) {
          metadata = {
            input_type: "TEXT",
            title: resolvedTitle,
            description: text || "",
          };
        }

        // Step 2: AI analysis (assign keyword, generate caption & embedding)
        setStatus("AI 분석 중...");
        const { data: aiResult, error: aiError } = await supabase.functions.invoke("assign-capture-keyword", {
          body: {
            title: resolvedTitle,
            description: text || "",
            content_type: isLink ? "LINK" : "TEXT",
            content_url: sharedUrl || "",
            metadata,
          },
        });

        if (aiError || !aiResult?.keyword_id || !aiResult?.ai_caption || !aiResult?.embedding) {
          console.error("AI pre-analysis failed:", aiError, aiResult);
          toast({
            title: "분석 실패",
            description: "AI 분석에 실패했습니다. 다시 시도해주세요.",
            variant: "destructive",
          });
          navigate("/network", { replace: true });
          return;
        }

        // Step 3: Insert capture with full data
        setStatus("저장 중...");
        const { error: insertError } = await supabase.from("captures").insert({
          creator_id: user.id,
          title: resolvedTitle,
          content_type: isLink ? "LINK" : "TEXT",
          content_url: sharedUrl || null,
          description: text || null,
          source: sharedUrl ? extractDomain(sharedUrl) : null,
          connected_to: aiResult.keyword_id,
          metadata,
          ai_caption: aiResult.ai_caption,
          embedding: aiResult.embedding,
        });

        if (insertError) throw insertError;

        const keywordTitle = aiResult.keyword_title || "";
        toast({
          title: "캡처 완료",
          description: keywordTitle
            ? `"${keywordTitle}" 키워드에 연결되었습니다.`
            : `"${resolvedTitle}" 이(가) 저장되었습니다.`,
        });
      } catch (err) {
        console.error("Share capture failed:", err);
        toast({
          title: "저장 실패",
          description: "캡처를 저장하지 못했습니다.",
          variant: "destructive",
        });
      }

      navigate("/network", { replace: true });
    };

    processCapture();
  }, [user, loading, searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <Sparkles className="w-8 h-8 text-accent animate-pulse" />
      <div className="text-foreground font-display text-lg tracking-widest">
        {status}
      </div>
      <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
    </div>
  );
}

function extractUrl(text: string): string {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : "";
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
