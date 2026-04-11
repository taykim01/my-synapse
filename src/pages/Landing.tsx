import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { ArrowRight, Zap, Brain, Network, Sparkles, Link2, Image, FileText, Type } from 'lucide-react';
import { SynapseLogo } from '@/components/SynapseLogo';

/* ─── Interactive Neural Canvas ─── */
function NeuralCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<{ x: number; y: number; vx: number; vy: number; r: number; color: string; pulse: number }[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = [
      'rgba(34,211,238,',
      'rgba(217,70,239,',
      'rgba(99,102,241,',
      'rgba(52,211,153,',
    ];

    const count = Math.min(60, Math.floor(window.innerWidth / 25));
    nodesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      pulse: Math.random() * Math.PI * 2,
    }));

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouse);

    let frame: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const nodes = nodesRef.current;
      const mouse = mouseRef.current;

      nodes.forEach(n => {
        n.x += n.vx;
        n.y += n.vy;
        n.pulse += 0.02;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;

        const dx = mouse.x - n.x;
        const dy = mouse.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200 && dist > 0) {
          n.vx += (dx / dist) * 0.02;
          n.vy += (dy / dist) * 0.02;
        }
        n.vx *= 0.99;
        n.vy *= 0.99;
      });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const alpha = (1 - dist / 150) * 0.15;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(100,140,180,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      nodes.forEach(n => {
        const glow = Math.sin(n.pulse) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * glow, 0, Math.PI * 2);
        ctx.fillStyle = n.color + (glow * 0.8).toFixed(2) + ')';
        ctx.fill();
      });

      frame = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0" />;
}

/* ─── Animated Section ─── */
function FadeInSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Demo Graph ─── */
function DemoGraph() {
  const nodes = [
    { id: 'me', x: 50, y: 50, r: 18, color: 'var(--primary)', label: '나' },
    { id: 'music', x: 22, y: 28, r: 12, color: 'var(--secondary)', label: '음악' },
    { id: 'dev', x: 78, y: 32, r: 12, color: 'var(--secondary)', label: '개발' },
    { id: 'history', x: 30, y: 75, r: 12, color: 'var(--secondary)', label: '역사' },
    { id: 'design', x: 75, y: 72, r: 12, color: 'var(--secondary)', label: '디자인' },
    { id: 'kpop', x: 8, y: 48, r: 8, color: 'hsl(var(--synapse-indigo))', label: 'K-POP' },
    { id: 'jazz', x: 18, y: 12, r: 8, color: 'hsl(var(--synapse-indigo))', label: '재즈' },
    { id: 'react', x: 92, y: 18, r: 8, color: 'hsl(var(--synapse-indigo))', label: 'React' },
    { id: 'c1', x: 5, y: 62, r: 5, color: 'var(--accent)', label: '' },
    { id: 'c2', x: 15, y: 55, r: 5, color: 'var(--accent)', label: '' },
    { id: 'c3', x: 88, y: 40, r: 5, color: 'var(--accent)', label: '' },
    { id: 'c4', x: 68, y: 85, r: 5, color: 'var(--accent)', label: '' },
    { id: 'c5', x: 38, y: 88, r: 5, color: 'var(--accent)', label: '' },
  ];
  const links = [
    ['me', 'music'], ['me', 'dev'], ['me', 'history'], ['me', 'design'],
    ['music', 'kpop'], ['music', 'jazz'], ['dev', 'react'],
    ['kpop', 'c1'], ['kpop', 'c2'], ['react', 'c3'], ['design', 'c4'], ['history', 'c5'],
  ];

  return (
    <div className="relative w-full aspect-square max-w-md mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {links.map(([s, t], i) => {
          const sn = nodes.find(n => n.id === s)!;
          const tn = nodes.find(n => n.id === t)!;
          return (
            <motion.line
              key={i}
              x1={sn.x} y1={sn.y} x2={tn.x} y2={tn.y}
              stroke="hsl(var(--border))"
              strokeWidth="0.3"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.6 }}
              transition={{ duration: 1, delay: 0.5 + i * 0.08 }}
            />
          );
        })}
        {nodes.map((n, i) => (
          <motion.g key={n.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.06, type: 'spring' }}
          >
            <circle cx={n.x} cy={n.y} r={n.r / 2.5} fill={n.color} opacity={0.9} />
            {n.label && (
              <text x={n.x} y={n.y + n.r / 2.5 + 4} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="3" fontFamily="var(--font-display)" opacity={0.8}>
                {n.label}
              </text>
            )}
          </motion.g>
        ))}
      </svg>
    </div>
  );
}

/* ─── Main Landing ─── */
export default function Landing() {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);

  const steps = [
    {
      icon: <Zap size={24} />,
      title: '캡처',
      desc: '텍스트, 링크, 이미지, 파일 — 떠오른 순간 바로 저장하세요.',
      icons: [Type, Link2, Image, FileText],
    },
    {
      icon: <Brain size={24} />,
      title: 'AI 분석',
      desc: 'AI가 내용을 분석하고, 의미를 이해하여 가장 적합한 카테고리를 자동으로 찾습니다.',
    },
    {
      icon: <Network size={24} />,
      title: '연결',
      desc: '당신만의 지식 네트워크가 자동으로 형성됩니다. 생각의 연결고리를 시각적으로 탐색하세요.',
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden overflow-y-auto"
      style={{ overflowY: 'auto' }}
    >
      {/* ── Hero ── */}
      <motion.section
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative h-screen flex flex-col items-center justify-center"
      >
        <NeuralCanvas />
        <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h1 className="mb-4">
              <SynapseLogo size="xl" />
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto mb-2">
              흩어진 생각의 파편들이<br />
              <span className="text-foreground font-medium">하나의 지식 네트워크</span>로 연결됩니다.
            </p>
            <p className="text-sm text-muted-foreground/60 mb-10">
              AI가 당신의 관심사를 이해하고, 자동으로 정리합니다.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <button
              onClick={() => { (window as any).gtag?.('event', 'click_signup', { location: 'hero' }); navigate('/auth?mode=signup'); }}
              className="group px-8 py-3.5 bg-accent text-accent-foreground rounded-full font-display font-medium text-sm tracking-wide hover:bg-accent/90 transition-all flex items-center justify-center gap-2"
            >
              시작하기
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="px-8 py-3.5 border border-border text-foreground rounded-full font-display text-sm tracking-wide hover:bg-muted/30 transition-colors"
            >
              로그인
            </button>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-5 h-8 rounded-full border border-muted-foreground/30 flex items-start justify-center p-1"
          >
            <div className="w-1 h-2 rounded-full bg-muted-foreground/50" />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ── What is Synapse ── */}
      <section className="relative py-32 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <FadeInSection>
            <p className="text-xs font-display text-primary tracking-[0.3em] uppercase mb-4">What is Synapse</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold leading-tight mb-6">
              모든 정보를<br />
              <span className="text-secondary">의미로 연결</span>하는<br />
              두 번째 뇌
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              유튜브 영상, 기사 링크, 메모, 이미지 — 매일 수많은 정보를 접하지만, 대부분 흩어져 사라집니다.
              Synapse는 AI가 각 정보의 <span className="text-foreground">의미를 분석</span>하여 관련 카테고리에 자동 분류하고,
              당신만의 <span className="text-foreground">지식 네트워크</span>를 만들어갑니다.
            </p>
          </FadeInSection>
          <FadeInSection delay={0.2}>
            <DemoGraph />
          </FadeInSection>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative py-32 px-6 bg-card/30">
        <div className="max-w-4xl mx-auto">
          <FadeInSection className="text-center mb-20">
            <p className="text-xs font-display text-primary tracking-[0.3em] uppercase mb-4">How it works</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold">
              세 단계로 완성되는<br />지식 네트워크
            </h2>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <FadeInSection key={i} delay={i * 0.15}>
                <div className="relative p-6 rounded-2xl border border-border bg-card/50 hover:border-primary/30 transition-colors group">
                  <div className="text-5xl font-display font-bold text-muted/30 absolute top-4 right-5">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    {step.icon}
                  </div>
                  <h3 className="text-lg font-display font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                  {step.icons && (
                    <div className="flex gap-2 mt-4">
                      {step.icons.map((Icon, j) => (
                        <div key={j} className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground">
                          <Icon size={14} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Key Features ── */}
      <section className="relative py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeInSection className="text-center mb-20">
            <p className="text-xs font-display text-primary tracking-[0.3em] uppercase mb-4">Features</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold">
              AI가 대신<br />정리해드립니다
            </h2>
          </FadeInSection>

          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                icon: <Sparkles size={20} />,
                title: '시맨틱 매칭',
                desc: '키워드가 아닌 의미를 기준으로 분류합니다. "조선 궁궐 온돌"은 자동으로 "역사"에 연결됩니다.',
                color: 'text-primary',
              },
              {
                icon: <Link2 size={20} />,
                title: '자동 메타데이터 추출',
                desc: 'URL만 붙여넣으면 제목, 설명, 태그, 채널명까지 자동으로 가져옵니다.',
                color: 'text-secondary',
              },
              {
                icon: <Network size={20} />,
                title: '세부 키워드 자동 생성',
                desc: '한 키워드에 다양한 주제가 쌓이면, AI가 자동으로 하위 카테고리를 만들어 정리합니다.',
                color: 'text-synapse-indigo',
              },
              {
                icon: <Brain size={20} />,
                title: '시각적 탐색',
                desc: '뉴런 네트워크처럼 펼쳐진 지식 지도에서 생각의 연결고리를 직관적으로 탐색하세요.',
                color: 'text-accent',
              },
            ].map((f, i) => (
              <FadeInSection key={i} delay={i * 0.1}>
                <div className="p-6 rounded-2xl border border-border hover:border-muted-foreground/20 transition-colors">
                  <div className={`mb-3 ${f.color}`}>{f.icon}</div>
                  <h3 className="font-display font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-32 px-6">
        <FadeInSection className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            당신의 두 번째 뇌를<br />
            <span className="text-gradient-synapse">지금 시작하세요</span>
          </h2>
          <p className="text-muted-foreground mb-10">
            무료로 시작하고, 지식이 연결되는 경험을 느껴보세요.
          </p>
          <button
            onClick={() => { (window as any).gtag?.('event', 'click_signup', { location: 'cta' }); navigate('/auth?mode=signup'); }}
            className="group px-10 py-4 bg-accent text-accent-foreground rounded-full font-display font-medium tracking-wide hover:bg-accent/90 transition-all inline-flex items-center gap-2"
          >
            무료로 시작하기
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </FadeInSection>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-4xl mx-auto flex justify-between items-center text-xs text-muted-foreground">
          <SynapseLogo size="sm" />
          <span>© 2026 Synapse. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
