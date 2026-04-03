import { useRef, useEffect, useCallback } from 'react';
import { useGalaxyStore, type GraphNode } from '@/stores/galaxyStore';

export function GalaxyCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef({
    draggedNode: null as GraphNode | null,
    width: 0,
    height: 0,
    camera: { x: 0, y: 0, zoom: 1, targetX: 0 },
  });

  const nodes = useGalaxyStore(s => s.nodes);
  const links = useGalaxyStore(s => s.links);
  const searchQuery = useGalaxyStore(s => s.searchQuery);
  const searchResults = useGalaxyStore(s => s.searchResults);
  const selectedNode = useGalaxyStore(s => s.selectedNode);
  const setSelectedNode = useGalaxyStore(s => s.setSelectedNode);

  // Camera shift when sidebar opens
  useEffect(() => {
    graphRef.current.camera.targetX = selectedNode
      ? (window.innerWidth < 768 ? -168 : -200)
      : 0;
  }, [selectedNode]);

  // Physics & Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      graphRef.current.width = canvas.width;
      graphRef.current.height = canvas.height;
    };
    window.addEventListener('resize', resize);
    resize();

    const backgroundStars = Array.from({ length: 200 }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 1500;
      return {
        angle,
        dist,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        size: Math.random() * 1.5,
        opacity: Math.random() * 0.5 + 0.1,
        speed: (Math.random() * 0.00003 + 0.00001), // very slow orbital speed
      };
    });

    let time = 0;

    const simulate = () => {
      const { draggedNode } = graphRef.current;
      const centerNode = nodes.find(n => n.type === 'center');

      nodes.forEach(node => { node.fx = 0; node.fy = 0; });

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i], n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const force = 10000 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          n1.fx -= fx; n1.fy -= fy;
          n2.fx += fx; n2.fy += fy;
        }
      }

      // Springs
      links.forEach(link => {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        if (!source || !target) return;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        let targetDist = 100;
        if (target.type === 'keyword') targetDist = 200;
        if (target.type === 'detailed_keyword') targetDist = 100;
        if (target.type === 'capture') targetDist = 60;
        const k = 0.05;
        const force = (dist - targetDist) * k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.fx += fx; source.fy += fy;
        target.fx -= fx; target.fy -= fy;
      });

      // Center gravity
      if (centerNode) {
        centerNode.fx += (0 - centerNode.x) * 0.05;
        centerNode.fy += (0 - centerNode.y) * 0.05;
      }

      // Slow orbital rotation for center, keyword, detailed_keyword nodes
      const orbitSpeed = 0.0003;
      nodes.forEach(node => {
        if (node === draggedNode) return;
        if (node.type === 'center' || node.type === 'keyword' || node.type === 'detailed_keyword') {
          const cx = 0;
          const cy = 0;
          const dx = node.x - cx;
          const dy = node.y - cy;
          const cosA = Math.cos(orbitSpeed);
          const sinA = Math.sin(orbitSpeed);
          const rx = dx * cosA - dy * sinA;
          const ry = dx * sinA + dy * cosA;
          node.fx += (cx + rx - node.x) * 0.5;
          node.fy += (cy + ry - node.y) * 0.5;
        }
      });

      // Update positions
      nodes.forEach(node => {
        if (node === draggedNode) return;
        node.vx = (node.vx || 0) * 0.8 + node.fx * 0.1;
        node.vy = (node.vy || 0) * 0.8 + node.fy * 0.1;
        node.x += node.vx;
        node.y += node.vy;
      });
    };

    const render = () => {
      const { camera, width, height } = graphRef.current;
      camera.x += (camera.targetX - camera.x) * 0.08;

      ctx.fillStyle = '#05050A';
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2 + camera.x, height / 2 + camera.y);
      ctx.scale(camera.zoom, camera.zoom);

      // Background stars
      backgroundStars.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Aura glow (screen blend)
      ctx.globalCompositeOperation = 'screen';
      nodes.forEach(node => {
        const auraSize = node.type === 'center' ? 150 : node.type === 'keyword' ? 100 : 50;
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, auraSize);
        let color = 'rgba(255,255,255,0)';
        if (node.type === 'center') color = 'rgba(252, 211, 77, 0.05)';
        if (node.type === 'keyword') color = 'rgba(96, 165, 250, 0.05)';
        if (node.type === 'detailed_keyword') color = 'rgba(167, 139, 250, 0.05)';
        if (node.type === 'capture') color = 'rgba(255, 255, 255, 0.08)';
        gradient.addColorStop(0, color.replace(/0\.[0-9]+\)/, '0.15)'));
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, auraSize, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';

      // Links
      links.forEach(link => {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        if (!source || !target) return;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Search highlight set
      const searchHighlightNodes = new Set(searchResults.map(r => r.id));

      // Nodes
      nodes.forEach(node => {
        ctx.beginPath();
        let radius = 5;
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 15;

        if (node.type === 'center') {
          radius = 12;
          ctx.fillStyle = '#fcd34d';
          ctx.shadowColor = '#f59e0b';
        } else if (node.type === 'keyword') {
          radius = 8;
          ctx.fillStyle = '#60a5fa';
          ctx.shadowColor = '#3b82f6';
        } else if (node.type === 'detailed_keyword') {
          radius = 6;
          ctx.fillStyle = '#a78bfa';
          ctx.shadowColor = '#8b5cf6';
        } else {
          radius = 4;
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#ffffff';
        }

        if (searchQuery && searchHighlightNodes.has(node.id)) {
          radius *= 2;
          ctx.shadowBlur = 30;
          ctx.shadowColor = '#10b981';
        } else if (searchQuery) {
          ctx.globalAlpha = 0.2;
        }

        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;

        // Labels
        if (node.type !== 'capture' || (searchQuery && searchHighlightNodes.has(node.id))) {
          ctx.font = node.type === 'center' ? 'bold 14px sans-serif' : '11px sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.textAlign = 'center';
          ctx.fillText(node.title, node.x, node.y + radius + 15);
        }
      });

      ctx.restore();
    };

    const loop = () => {
      simulate();
      render();
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [nodes, links, searchQuery, searchResults]);

  // Mouse/touch events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let isMoved = false;

    const getMousePos = (e: MouseEvent) => {
      const { width, height, camera } = graphRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - width / 2 - camera.x) / camera.zoom;
      const y = (e.clientY - rect.top - height / 2 - camera.y) / camera.zoom;
      return { x, y };
    };

    const handleMouseDown = (e: MouseEvent) => {
      const { x, y } = getMousePos(e);
      startX = e.clientX;
      startY = e.clientY;
      isMoved = false;
      let nodeClicked = false;

      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const dx = node.x - x;
        const dy = node.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < 20) {
          graphRef.current.draggedNode = node;
          isDragging = true;
          nodeClicked = true;
          break;
        }
      }

      if (!nodeClicked) {
        setSelectedNode(null);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !graphRef.current.draggedNode) return;
      if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) {
        isMoved = true;
      }
      const { x, y } = getMousePos(e);
      graphRef.current.draggedNode.x = x;
      graphRef.current.draggedNode.y = y;
      graphRef.current.draggedNode.vx = 0;
      graphRef.current.draggedNode.vy = 0;
    };

    const handleMouseUp = () => {
      if (isDragging && graphRef.current.draggedNode && !isMoved) {
        const clickedType = graphRef.current.draggedNode.type;
        if (clickedType === 'capture' || clickedType === 'keyword') {
          setSelectedNode(graphRef.current.draggedNode);
        }
      }
      isDragging = false;
      graphRef.current.draggedNode = null;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [nodes, setSelectedNode]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 touch-none" />;
}
