import { useRef, useEffect } from 'react';
import { useGalaxyStore, type GraphNode } from '@/stores/galaxyStore';
import { toast } from 'sonner';

interface StarBirth {
  x: number; y: number;
  birth: number; duration: number; color: string;
  particles: { angle: number; speed: number; size: number }[];
}

interface NebulaPatch {
  cx: number; cy: number;
  radius: number;
  color: string;
  targetOpacity: number;
  opacity: number;
  angle: number;
  drift: number;
}

// Synapse color palette
const NODE_COLORS = {
  center:           { core: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)' },
  keyword:          { core: '#d946ef', glow: 'rgba(217, 70, 239, 0.4)' },
  detailed_keyword: { core: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)' },
  capture:          { core: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
} as const;

// Thumbnail image cache
const thumbnailCache = new Map<string, HTMLImageElement | null>();

function loadThumbnail(url: string): HTMLImageElement | null {
  if (thumbnailCache.has(url)) return thumbnailCache.get(url)!;
  thumbnailCache.set(url, null); // mark as loading
  const img = new window.Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => thumbnailCache.set(url, img);
  img.onerror = () => thumbnailCache.set(url, null);
  img.src = url;
  return null;
}

export function SynapseCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef({
    draggedNode: null as GraphNode | null,
    width: 0,
    height: 0,
    camera: { x: 0, y: 0, panX: 0, panY: 0, zoom: 1, targetX: 0 },
    ctrlDrag: false,
    dropTarget: null as GraphNode | null,
  });
  const birthsRef = useRef<StarBirth[]>([]);
  const nebulaeRef = useRef<NebulaPatch[]>([]);
  const prevNodeCountRef = useRef(0);
  const prevLinkCountRef = useRef(0);

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

  // Detect new nodes/links → trigger discovery flash & update nebulae
  useEffect(() => {
    const prevLinks = prevLinkCountRef.current;
    prevNodeCountRef.current = nodes.length;
    prevLinkCountRef.current = links.length;

    if (prevLinks > 0 && links.length > prevLinks) {
      const newLinks = links.slice(prevLinks);
      newLinks.forEach(link => {
        const target = nodes.find(n => n.id === link.target);
        if (target) {
          const isDetailed = target.type === 'detailed_keyword';
          const particleCount = isDetailed ? 24 : 16;
          const colors = NODE_COLORS[target.type as keyof typeof NODE_COLORS] || NODE_COLORS.capture;
          birthsRef.current.push({
            x: target.x, y: target.y,
            birth: performance.now(),
            duration: isDetailed ? 2000 : 1200,
            color: colors.core,
            particles: Array.from({ length: particleCount }, () => ({
              angle: Math.random() * Math.PI * 2,
              speed: 20 + Math.random() * 60,
              size: 1 + Math.random() * 2.5,
            })),
          });
        }
      });
    }

    rebuildNebulae();
  }, [nodes, links]);

  const rebuildNebulae = () => {
    const keywordNodes = nodes.filter(n => n.type === 'keyword' || n.type === 'detailed_keyword');
    const newNebulae: NebulaPatch[] = [];

    keywordNodes.forEach(kw => {
      const connectedIds = new Set<string>();
      links.forEach(l => {
        if (l.source === kw.id) connectedIds.add(l.target);
        if (l.target === kw.id) connectedIds.add(l.source);
      });
      const captureCount = nodes.filter(n => connectedIds.has(n.id) && n.type === 'capture').length;

      if (captureCount >= 1) {
        const intensity = Math.min(captureCount / 8, 1);
        const baseRadius = 80 + captureCount * 25;
        const color = kw.type === 'keyword' ? '217, 70, 239' : '99, 102, 241';

        newNebulae.push({
          cx: kw.x, cy: kw.y,
          radius: baseRadius,
          color,
          targetOpacity: 0.015 + intensity * 0.04,
          opacity: 0,
          angle: Math.random() * Math.PI * 2,
          drift: 0.0001 + Math.random() * 0.0002,
        });

        if (captureCount >= 3) {
          for (let i = 0; i < 2; i++) {
            const offsetAngle = Math.random() * Math.PI * 2;
            const offsetDist = baseRadius * 0.4;
            newNebulae.push({
              cx: kw.x + Math.cos(offsetAngle) * offsetDist,
              cy: kw.y + Math.sin(offsetAngle) * offsetDist,
              radius: baseRadius * 0.6,
              color: i === 0 ? '6, 182, 212' : color,
              targetOpacity: 0.01 + intensity * 0.02,
              opacity: 0,
              angle: Math.random() * Math.PI * 2,
              drift: 0.00015 + Math.random() * 0.00015,
            });
          }
        }
      }
    });

    const existing = nebulaeRef.current;
    if (newNebulae.length > 0) {
      newNebulae.forEach((n, i) => {
        if (existing[i]) {
          n.opacity = existing[i].opacity;
        }
      });
    }
    nebulaeRef.current = newNebulae;
  };

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

    let time = 0;

    const simulate = () => {
      const { draggedNode, ctrlDrag } = graphRef.current;

      // Freeze all physics when ctrl+dragging to prevent nodes from repelling
      if (ctrlDrag && draggedNode) {
        return;
      }

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

      // Slow orbital rotation
      const orbitSpeed = 0.0003;
      nodes.forEach(node => {
        if (node === draggedNode) return;
        if (node.type === 'center' || node.type === 'keyword' || node.type === 'detailed_keyword') {
          const dx = node.x;
          const dy = node.y;
          const cosA = Math.cos(orbitSpeed);
          const sinA = Math.sin(orbitSpeed);
          const rx = dx * cosA - dy * sinA;
          const ry = dx * sinA + dy * cosA;
          node.fx += (rx - node.x) * 0.5;
          node.fy += (ry - node.y) * 0.5;
        }
      });

      // Update positions — REDUCED velocity for slower drag response
      nodes.forEach(node => {
        if (node === draggedNode) return;
        node.vx = (node.vx || 0) * 0.85 + node.fx * 0.06;
        node.vy = (node.vy || 0) * 0.85 + node.fy * 0.06;
        node.x += node.vx;
        node.y += node.vy;
      });
    };

    const render = () => {
      const { camera, width, height, ctrlDrag, draggedNode, dropTarget } = graphRef.current;
      const now = performance.now();
      camera.x += (camera.targetX + camera.panX - camera.x) * 0.08;
      camera.y += (camera.panY - camera.y) * 0.08;

      ctx.fillStyle = 'rgba(5, 5, 10, 0.6)';
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2 + camera.x, height / 2 + camera.y);
      ctx.scale(camera.zoom, camera.zoom);

      time++;

      // ===== STAR BIRTH EXPLOSIONS =====
      birthsRef.current = birthsRef.current.filter(b => now - b.birth < b.duration);
      birthsRef.current.forEach(birth => {
        const progress = (now - birth.birth) / birth.duration;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        if (progress < 0.3) {
          const flashAlpha = (1 - progress / 0.3);
          const flashRadius = 8 + progress * 80;
          const g = ctx.createRadialGradient(birth.x, birth.y, 0, birth.x, birth.y, flashRadius);
          g.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha * 0.9})`);
          g.addColorStop(0.3, birth.color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = flashAlpha;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(birth.x, birth.y, flashRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        const ringCount = 2;
        for (let r = 0; r < ringCount; r++) {
          const ringDelay = r * 0.15;
          const ringProgress = Math.max(0, progress - ringDelay);
          if (ringProgress <= 0 || ringProgress > 0.8) continue;
          const rp = ringProgress / 0.8;
          const ringRadius = rp * 50;
          const ringAlpha = (1 - rp) * 0.6;
          ctx.globalAlpha = ringAlpha;
          ctx.strokeStyle = birth.color;
          ctx.lineWidth = 1.5 * (1 - rp);
          ctx.shadowColor = birth.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(birth.x, birth.y, ringRadius, 0, Math.PI * 2);
          ctx.stroke();
        }

        const particleFade = progress < 0.2 ? progress / 0.2 : Math.max(0, 1 - (progress - 0.2) / 0.8);
        birth.particles.forEach(p => {
          const dist = p.speed * progress;
          const px = birth.x + Math.cos(p.angle) * dist;
          const py = birth.y + Math.sin(p.angle) * dist;
          const size = p.size * (1 - progress * 0.7);
          if (size <= 0) return;
          ctx.globalAlpha = particleFade * 0.9;
          ctx.fillStyle = birth.color;
          ctx.shadowColor = birth.color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        });

        if (progress < 0.6) {
          const coreAlpha = (1 - progress / 0.6) * 0.8;
          ctx.globalAlpha = coreAlpha;
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = birth.color;
          ctx.shadowBlur = 25;
          ctx.beginPath();
          ctx.arc(birth.x, birth.y, 3 * (1 - progress), 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // ===== LEVEL OF DETAIL =====
      const zoom = camera.zoom;
      const showCaptures = zoom > 0.55;
      const showDetailed = zoom > 0.25;
      const captureAlpha = showCaptures ? Math.min(1, (zoom - 0.55) / 0.15) : 0;
      const detailedAlpha = showDetailed ? Math.min(1, (zoom - 0.25) / 0.1) : 0;
      const showThumbnails = zoom > 2.0;
      const thumbnailAlpha = showThumbnails ? Math.min(1, (zoom - 2.0) / 0.5) : 0;

      // ===== LINKS (organic curved synapses) =====
      links.forEach(link => {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        if (!source || !target) return;

        if (target.type === 'capture' && !showCaptures) return;
        if (target.type === 'detailed_keyword' && !showDetailed) return;

        let linkAlpha = 0.25;
        if (target.type === 'capture') linkAlpha *= captureAlpha;
        else if (target.type === 'detailed_keyword') linkAlpha *= detailedAlpha;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        const mx = (source.x + target.x) / 2;
        const my = (source.y + target.y) / 2;
        const offset = 15;
        ctx.quadraticCurveTo(mx + offset, my + offset, target.x, target.y);
        ctx.strokeStyle = `rgba(100, 116, 139, ${linkAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Search highlight set
      const searchHighlightNodes = new Set(searchResults.map(r => r.id));

      // ===== CTRL+DRAG DROP TARGET HIGHLIGHT =====
      if (ctrlDrag && dropTarget) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(dropTarget.x, dropTarget.y, 25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // ===== NODES =====
      nodes.forEach(node => {
        if (node.type === 'capture' && !showCaptures && !(searchQuery && searchHighlightNodes.has(node.id))) return;
        if (node.type === 'detailed_keyword' && !showDetailed) return;

        const colors = NODE_COLORS[node.type as keyof typeof NODE_COLORS] || NODE_COLORS.capture;

        let radius = 5;
        if (node.type === 'center') radius = 12;
        else if (node.type === 'keyword') radius = 8;
        else if (node.type === 'detailed_keyword') radius = 6;
        else radius = 4;

        // Core (flat, no glow)
        ctx.beginPath();
        ctx.fillStyle = colors.core;

        let nodeAlpha = 1;
        if (node.type === 'capture') nodeAlpha = captureAlpha;
        else if (node.type === 'detailed_keyword') nodeAlpha = detailedAlpha;

        if (searchQuery && searchHighlightNodes.has(node.id)) {
          radius *= 2;
          nodeAlpha = 1;
        } else if (searchQuery) {
          nodeAlpha *= 0.05;
        }

        ctx.globalAlpha = nodeAlpha;
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Center node white ring
        if (node.type === 'center') {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.globalAlpha = 1.0;

        // Thumbnail for captures when zoomed in enough
        if (node.type === 'capture' && showThumbnails && nodeAlpha > 0.3 && node.content_url) {
          const isImage = node.content_type === 'IMAGE';
          if (isImage) {
            const img = loadThumbnail(node.content_url);
            if (img) {
              const thumbSize = 32;
              ctx.globalAlpha = thumbnailAlpha * nodeAlpha;
              ctx.save();
              ctx.beginPath();
              ctx.roundRect(node.x - thumbSize / 2, node.y - radius - thumbSize - 4, thumbSize, thumbSize, 4);
              ctx.clip();
              ctx.drawImage(img, node.x - thumbSize / 2, node.y - radius - thumbSize - 4, thumbSize, thumbSize);
              ctx.restore();
              ctx.globalAlpha = thumbnailAlpha * nodeAlpha * 0.5;
              ctx.strokeStyle = colors.core;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.roundRect(node.x - thumbSize / 2, node.y - radius - thumbSize - 4, thumbSize, thumbSize, 4);
              ctx.stroke();
              ctx.globalAlpha = 1.0;
            }
          }
        }

        // Labels for non-capture nodes
        if (node.type !== 'capture') {
          if (nodeAlpha > 0.3 && zoom > 0.4) {
            ctx.globalAlpha = nodeAlpha;
            ctx.font = node.type === 'center' ? 'bold 14px sans-serif' : '11px sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.textAlign = 'center';
            ctx.fillText(node.title, node.x, node.y + radius + 15);
            ctx.globalAlpha = 1.0;
          }
        }

        // Capture labels
        if (node.type === 'capture' && nodeAlpha > 0.3) {
          const showCaptureLabels = zoom > 1.2;
          const isSearchHighlight = searchQuery && searchHighlightNodes.has(node.id);
          if (showCaptureLabels || isSearchHighlight) {
            const capLabelAlpha = isSearchHighlight
              ? nodeAlpha
              : Math.min(1, (zoom - 1.2) / 0.3) * nodeAlpha;
            ctx.globalAlpha = capLabelAlpha;
            ctx.font = '9px sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.textAlign = 'center';
            const label = node.title.length > 16 ? node.title.slice(0, 15) + '…' : node.title;
            ctx.fillText(label, node.x, node.y + radius + 12);
            ctx.globalAlpha = 1.0;
          }
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
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let panStartCamX = 0;
    let panStartCamY = 0;
    let isMoved = false;
    let lastPinchDist = 0;
    let isPinching = false;

    const getTouchPos = (touch: Touch) => {
      const { width, height, camera } = graphRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (touch.clientX - rect.left - width / 2 - camera.x) / camera.zoom;
      const y = (touch.clientY - rect.top - height / 2 - camera.y) / camera.zoom;
      return { x, y };
    };

    const getMousePos = (e: MouseEvent) => {
      const { width, height, camera } = graphRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - width / 2 - camera.x) / camera.zoom;
      const y = (e.clientY - rect.top - height / 2 - camera.y) / camera.zoom;
      return { x, y };
    };

    const getPinchDist = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const findNearestDropTarget = (x: number, y: number, excludeId: string): GraphNode | null => {
      let best: GraphNode | null = null;
      let bestDist = 30; // snap distance
      for (const node of nodes) {
        if (node.id === excludeId) continue;
        if (node.type !== 'keyword' && node.type !== 'detailed_keyword' && node.type !== 'center') continue;
        const dx = node.x - x;
        const dy = node.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          best = node;
        }
      }
      return best;
    };

    const handleMouseDown = (e: MouseEvent) => {
      const { x, y } = getMousePos(e);
      startX = e.clientX;
      startY = e.clientY;
      isMoved = false;
      graphRef.current.ctrlDrag = e.ctrlKey || e.metaKey;
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
        isPanning = true;
        panStartCamX = graphRef.current.camera.panX;
        panStartCamY = graphRef.current.camera.panY;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isMoved = true;
        graphRef.current.camera.panX = panStartCamX + dx;
        graphRef.current.camera.panY = panStartCamY + dy;
        return;
      }
      if (!isDragging || !graphRef.current.draggedNode) return;
      if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) {
        isMoved = true;
      }
      const { x, y } = getMousePos(e);
      graphRef.current.draggedNode.x = x;
      graphRef.current.draggedNode.y = y;
      graphRef.current.draggedNode.vx = 0;
      graphRef.current.draggedNode.vy = 0;

      // Update ctrl state dynamically
      graphRef.current.ctrlDrag = e.ctrlKey || e.metaKey;

      // Find drop target if ctrl+dragging
      if (graphRef.current.ctrlDrag && isMoved) {
        graphRef.current.dropTarget = findNearestDropTarget(x, y, graphRef.current.draggedNode.id);
      } else {
        graphRef.current.dropTarget = null;
      }
    };

    const handleMouseUp = async (e: MouseEvent) => {
      const dragged = graphRef.current.draggedNode;
      const drop = graphRef.current.dropTarget;
      const wasCtrlDrag = graphRef.current.ctrlDrag && isMoved && dragged && drop;

      if (wasCtrlDrag && dragged && drop) {
        // Perform reparent
        const store = useGalaxyStore.getState();
        let ok = false;
        if (dragged.type === 'capture') {
          ok = await store.moveCapture(dragged.id, drop.id);
        } else if (dragged.type === 'keyword' || dragged.type === 'detailed_keyword') {
          const targetParent = drop.type === 'center' ? null : drop.id;
          ok = await store.moveNode(dragged.id, targetParent);
        }
        if (ok) {
          toast.success(`"${dragged.title}"을(를) "${drop.title}" 하위로 이동했습니다.`);
        }
      } else if (isPanning && !isMoved) {
        setSelectedNode(null);
      } else if (isDragging && dragged && !isMoved) {
        const clickedType = dragged.type;
        if (clickedType === 'capture' || clickedType === 'keyword' || clickedType === 'detailed_keyword' || clickedType === 'center') {
          setSelectedNode(dragged);
        }
      }

      isDragging = false;
      isPanning = false;
      graphRef.current.draggedNode = null;
      graphRef.current.ctrlDrag = false;
      graphRef.current.dropTarget = null;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = graphRef.current.camera;
      const { width, height } = graphRef.current;
      const rect = canvas.getBoundingClientRect();

      // Mouse position in screen coords relative to center
      const mouseScreenX = e.clientX - rect.left - width / 2 - cam.x;
      const mouseScreenY = e.clientY - rect.top - height / 2 - cam.y;

      // Mouse position in world coords before zoom
      const worldX = mouseScreenX / cam.zoom;
      const worldY = mouseScreenY / cam.zoom;

      const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
      const newZoom = Math.max(0.15, Math.min(4, cam.zoom * zoomFactor));

      // Adjust pan so mouse stays on same world point
      cam.panX += worldX * (cam.zoom - newZoom);
      cam.panY += worldY * (cam.zoom - newZoom);
      cam.zoom = newZoom;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        isPinching = true;
        lastPinchDist = getPinchDist(e.touches);
        return;
      }
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const { x, y } = getTouchPos(touch);
        startX = touch.clientX;
        startY = touch.clientY;
        isMoved = false;
        let nodeClicked = false;

        for (let i = nodes.length - 1; i >= 0; i--) {
          const node = nodes[i];
          const dx = node.x - x;
          const dy = node.y - y;
          if (Math.sqrt(dx * dx + dy * dy) < 25) {
            graphRef.current.draggedNode = node;
            isDragging = true;
            nodeClicked = true;
            break;
          }
        }
        if (!nodeClicked) {
          isPanning = true;
          panStartCamX = graphRef.current.camera.panX;
          panStartCamY = graphRef.current.camera.panY;
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isPinching && e.touches.length === 2) {
        e.preventDefault();
        const cam = graphRef.current.camera;
        const newDist = getPinchDist(e.touches);
        const scale = newDist / lastPinchDist;

        // Pinch center for zoom-to-point
        const rect = canvas.getBoundingClientRect();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const mouseScreenX = cx - rect.left - graphRef.current.width / 2 - cam.x;
        const mouseScreenY = cy - rect.top - graphRef.current.height / 2 - cam.y;
        const worldX = mouseScreenX / cam.zoom;
        const worldY = mouseScreenY / cam.zoom;

        const newZoom = Math.max(0.15, Math.min(4, cam.zoom * scale));
        cam.panX += worldX * (cam.zoom - newZoom);
        cam.panY += worldY * (cam.zoom - newZoom);
        cam.zoom = newZoom;
        lastPinchDist = newDist;
        return;
      }
      if (isPanning && e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isMoved = true;
        graphRef.current.camera.panX = panStartCamX + dx;
        graphRef.current.camera.panY = panStartCamY + dy;
        return;
      }
      if (isDragging && graphRef.current.draggedNode && e.touches.length === 1) {
        const touch = e.touches[0];
        if (Math.abs(touch.clientX - startX) > 3 || Math.abs(touch.clientY - startY) > 3) {
          isMoved = true;
        }
        const { x, y } = getTouchPos(touch);
        graphRef.current.draggedNode.x = x;
        graphRef.current.draggedNode.y = y;
        graphRef.current.draggedNode.vx = 0;
        graphRef.current.draggedNode.vy = 0;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isPinching) {
        if (e.touches.length < 2) isPinching = false;
        return;
      }
      if (isPanning && !isMoved) {
        setSelectedNode(null);
      }
      if (isDragging && graphRef.current.draggedNode && !isMoved) {
        const clickedType = graphRef.current.draggedNode.type;
        if (clickedType === 'capture' || clickedType === 'keyword' || clickedType === 'detailed_keyword' || clickedType === 'center') {
          setSelectedNode(graphRef.current.draggedNode);
        }
      }
      isDragging = false;
      isPanning = false;
      graphRef.current.draggedNode = null;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [nodes, setSelectedNode]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 touch-none" />;
}
