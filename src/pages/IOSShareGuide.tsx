import { useNavigate } from "react-router-dom";
import { ArrowLeft, Share, Plus, Play, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const PUBLISHED_URL = "https://my-synapse.lovable.app";

const steps = [
  {
    title: "단축어 앱 열기",
    description: "iPhone에서 '단축어' 앱을 엽니다. 없다면 App Store에서 다운로드하세요.",
    icon: Play,
  },
  {
    title: "새 단축어 만들기",
    description: "오른쪽 상단의 '+' 버튼을 탭해 새 단축어를 생성합니다.",
    icon: Plus,
  },
  {
    title: "'URL 열기' 동작 추가",
    description: `'동작 추가'를 탭하고 'URL 열기'를 검색하여 추가합니다. URL 필드에 아래 주소를 입력하세요:`,
    icon: ExternalLink,
    code: `${PUBLISHED_URL}/share?url=단축어입력&title=공유`,
  },
  {
    title: "공유 시트에 표시 설정",
    description:
      "상단의 단축어 이름을 탭하여 'Synapse에 저장'으로 변경합니다. 그 옆 ⓘ (또는 설정 아이콘)을 탭한 뒤 '공유 시트에 표시'를 켜세요.",
    icon: Share,
  },
  {
    title: "입력 유형 설정",
    description:
      "같은 설정 화면에서 '공유 시트 유형'을 탭하고 'URL'과 '텍스트'만 선택합니다. 이렇게 하면 URL이나 텍스트를 공유할 때만 이 단축어가 나타납니다.",
    icon: Share,
  },
  {
    title: "'단축어 입력'을 URL에 연결",
    description:
      "URL 열기 동작의 URL 필드에서 '단축어입력' 부분을 지우고, 키보드 위의 변수 목록에서 '단축어 입력'을 탭하여 삽입하세요. 최종 URL이 아래와 같이 되어야 합니다:",
    icon: ExternalLink,
    code: `${PUBLISHED_URL}/share?url=[단축어 입력]&title=공유`,
  },
];
export default function IOSShareGuide() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display text-lg tracking-wide">iOS 공유 설정</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Intro */}
        <div className="space-y-3">
          <h2 className="text-2xl font-display tracking-tight">
            iOS에서 Synapse로 공유하기
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            iOS는 Web Share Target API를 지원하지 않지만,{" "}
            <span className="text-primary font-medium">단축어(Shortcuts)</span>를
            활용하면 유튜브, 인스타그램 등 어떤 앱에서든 Synapse로 바로 저장할 수
            있습니다.
          </p>
        </div>

        {/* Steps */}
        <ol className="space-y-6">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                  {i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className="w-px flex-1 bg-border/40 mt-2" />
                )}
              </div>
              <div className="pb-6 space-y-2">
                <h3 className="font-semibold text-base">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.description}
                </p>
                {step.code && (
                  <div className="mt-2 bg-muted/50 border border-border/50 rounded-lg p-3 font-mono text-xs break-all select-all">
                    {step.code}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>

        {/* Tips */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-2">
          <h3 className="font-display text-sm tracking-wide text-primary">
            💡 팁
          </h3>
          <ul className="text-muted-foreground text-sm space-y-1.5 list-disc list-inside">
            <li>
              <span className="text-primary font-medium">PWA가 홈 화면에 설치되어 있으면</span>, 단축어가 자동으로 Synapse 앱을 열어줍니다. (Safari가 아닌 앱으로 바로 실행)
            </li>
            <li>PWA 설치 방법: Safari에서 Synapse 접속 → 공유 버튼(□↑) → '홈 화면에 추가'</li>
            <li>공유된 링크는 AI가 자동으로 분석하여 제목, 키워드, 카테고리를 생성합니다.</li>
            <li>설정 후 아무 앱에서 공유 → 'Synapse에 저장'을 탭하면 됩니다.</li>
          </ul>
        </div>

        {/* CTA */}
        <div className="text-center pt-4">
          <Button
            onClick={() =>
              window.open(
                "shortcuts://create-shortcut",
                "_blank"
              )
            }
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            단축어 앱 열기
          </Button>
        </div>
      </main>
    </div>
  );
}
