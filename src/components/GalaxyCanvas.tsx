import { useRef, useCallback, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useGalaxyStore } from '@/stores/galaxyStore';
import type { GalaxyNode } from '@/types/galaxy';

function NodeElement({ node, onSelect }: { node: GalaxyNode; onSelect: (n: GalaxyNode) => void }) {
  const updateNodePosition = useGalaxyStore(s => s.updateNodePosition);
  const resetNodePosition = useGalaxyStore(s => s.resetNodePosition);
  const [isDragging, setIsDragging] = useState(false);

  const x = useMotionValue(node.x);
  const y = useMotionValue(node.y);
  const springX = useSpring(x, { stiffness: 200, damping: 20 });
  const springY = useSpring(y, { stiffness: 200, damping: 20 });

  useEffect(() => {
    if (!isDragging) {
      x.set(node.x);
      y.set(node.y);
    }
  }, [node.x, node.y, isDragging]);

  const glowSize = node.glowIntensity * 30;
  const isCenter = node.type === 'center';
  const isCapture = node.type === 'capture';

  return (
    <motion.g
      style={{ x: springX, y: springY }}
      onPointerDown={() => setIsDragging(true)}
      onPointerUp={() => {
        setIsDragging(false);
        resetNodePosition(node.id);
      }}
      drag
      dragMomentum={false}
      onDrag={(_, info) => {
        x.set(node.x + info.offset.x);
        y.set(node.y + info.offset.y);
      }}
      onDragEnd={() => {
        setIsDragging(false);
        resetNodePosition(node.id);
      }}
      onClick={() => onSelect(node)}
      className="cursor-pointer"
    >
      {/* Glow effect */}
      <motion.circle
        r={node.size + glowSize}
        fill={node.color}
        opacity={node.glowIntensity * 0.15}
        animate={{ 
          r: [node.size + glowSize, node.size + glowSize + 5, node.size + glowSize],
          opacity: [node.glowIntensity * 0.15, node.glowIntensity * 0.25, node.glowIntensity * 0.15]
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Core */}
      <circle
        r={node.size}
        fill={node.color}
        opacity={isCapture ? 0.85 : 1}
        filter={isCenter ? 'url(#centerGlow)' : undefined}
      />
      {/* Inner bright core */}
      <circle
        r={node.size * 0.4}
        fill="white"
        opacity={isCenter ? 0.6 : 0.3}
      />
      {/* Label */}
      {!isCapture && (
        <text
          y={node.size + 18}
          textAnchor="middle"
          fill="hsl(220, 20%, 80%)"
          fontSize={isCenter ? 14 : 11}
          fontFamily="'Space Grotesk', sans-serif"
          fontWeight={isCenter ? 600 : 400}
        >
          {node.label}
        </text>
      )}
    </motion.g>
  );
}

export function GalaxyCanvas() {
  const nodes = useGalaxyStore(s => s.nodes);
  const connections = useGalaxyStore(s => s.connections);
  const selectNode = useGalaxyStore(s => s.selectNode);
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState({ x: -500, y: -400, w: 1000, h: 800 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const getNode = useCallback((id: string) => nodes.find(n => n.id === id), [nodes]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scale = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox(v => ({
      x: v.x + v.w * (1 - scale) / 2,
      y: v.y + v.h * (1 - scale) / 2,
      w: v.w * scale,
      h: v.h * scale,
    }));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target === svgRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = viewBox.h / rect.height;
    const dx = (e.clientX - panStart.x) * scaleX;
    const dy = (e.clientY - panStart.y) * scaleY;
    setViewBox(v => ({ ...v, x: v.x - dx, y: v.y - dy }));
    setPanStart({ x: e.clientX, y: e.clientY });
  }, [isPanning, panStart, viewBox]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: 'none' }}
    >
      <defs>
        <filter id="centerGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      {/* Connections */}
      {connections.map(conn => {
        const from = getNode(conn.from);
        const to = getNode(conn.to);
        if (!from || !to) return null;
        return (
          <g key={conn.id}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="hsl(220, 30%, 30%)"
              strokeWidth={1}
              opacity={conn.strength * 0.6}
              filter="url(#lineGlow)"
            />
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="hsl(220, 40%, 50%)"
              strokeWidth={0.5}
              opacity={conn.strength * 0.4}
            />
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map(node => (
        <NodeElement key={node.id} node={node} onSelect={selectNode} />
      ))}
    </svg>
  );
}
