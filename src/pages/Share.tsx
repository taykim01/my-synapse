import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Share() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const processed = useRef(false);

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

    // URL 추출: url 파라미터 우선, 없으면 text에서 URL 추출
    const sharedUrl = url || extractUrl(text) || "";
    const sharedTitle = title || text.slice(0, 100) || "공유된 캡처";
    const isLink = !!sharedUrl;

    const createCapture = async () => {
      try {
        const { error } = await supabase.from("captures").insert({
          creator_id: user.id,
          title: sharedTitle,
          content_type: isLink ? "LINK" : "TEXT",
          content_url: sharedUrl || null,
          description: text || null,
          source: sharedUrl ? extractDomain(sharedUrl) : "share",
        });

        if (error) throw error;

        toast({
          title: "캡처 완료",
          description: `"${sharedTitle}" 이(가) 저장되었습니다.`,
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

    createCapture();
  }, [user, loading, searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-primary font-display text-xl tracking-widest animate-pulse">
        저장 중...
      </div>
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
