import { create } from 'zustand';
import type { GalaxyNode, Connection, CaptureInput } from '@/types/galaxy';

const KEYWORDS_COLORS = [
  'hsl(260, 60%, 65%)',  // purple
  'hsl(165, 70%, 50%)',  // teal
  'hsl(40, 85%, 78%)',   // warm
  'hsl(200, 70%, 60%)',  // blue
  'hsl(330, 60%, 65%)',  // pink
  'hsl(120, 50%, 55%)',  // green
  'hsl(280, 50%, 70%)',  // lavender
  'hsl(20, 80%, 65%)',   // orange
];

function positionAroundCenter(index: number, total: number, radius: number) {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

interface GalaxyState {
  nodes: GalaxyNode[];
  connections: Connection[];
  keywords: string[];
  isOnboarded: boolean;
  captureModalOpen: boolean;
  selectedNode: GalaxyNode | null;

  setOnboarded: (keywords: string[]) => void;
  addCapture: (input: CaptureInput) => void;
  openCaptureModal: () => void;
  closeCaptureModal: () => void;
  selectNode: (node: GalaxyNode | null) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  resetNodePosition: (id: string) => void;
}

export const useGalaxyStore = create<GalaxyState>((set, get) => ({
  nodes: [],
  connections: [],
  keywords: [],
  isOnboarded: false,
  captureModalOpen: false,
  selectedNode: null,

  setOnboarded: (keywords) => {
    const centerNode: GalaxyNode = {
      id: 'center',
      type: 'center',
      label: '나',
      x: 0,
      y: 0,
      originX: 0,
      originY: 0,
      size: 40,
      color: 'hsl(260, 80%, 75%)',
      glowIntensity: 1,
    };

    const keywordNodes: GalaxyNode[] = keywords.map((kw, i) => {
      const pos = positionAroundCenter(i, keywords.length, 220);
      return {
        id: `kw-${generateId()}`,
        type: 'keyword' as const,
        label: kw,
        x: pos.x,
        y: pos.y,
        originX: pos.x,
        originY: pos.y,
        size: 18,
        color: KEYWORDS_COLORS[i % KEYWORDS_COLORS.length],
        glowIntensity: 0.3,
        captureCount: 0,
      };
    });

    const connections: Connection[] = keywordNodes.map(kn => ({
      id: `conn-${generateId()}`,
      from: 'center',
      to: kn.id,
      strength: 0.5,
    }));

    set({
      nodes: [centerNode, ...keywordNodes],
      connections,
      keywords,
      isOnboarded: true,
    });
  },

  addCapture: (input) => {
    const state = get();
    const keywordNodes = state.nodes.filter(n => n.type === 'keyword');

    // Simple matching: find the best keyword by checking if tags or title contain keyword label
    let bestMatch = keywordNodes[0];
    let bestScore = 0;
    for (const kn of keywordNodes) {
      const searchStr = `${input.title} ${input.body} ${input.tags.join(' ')}`.toLowerCase();
      const kwLower = kn.label.toLowerCase();
      if (searchStr.includes(kwLower)) {
        const score = kwLower.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = kn;
        }
      }
    }

    if (!bestMatch) bestMatch = keywordNodes[0];

    // Position capture near the matched keyword
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    const cx = bestMatch.x + Math.cos(angle) * dist;
    const cy = bestMatch.y + Math.sin(angle) * dist;

    const captureNode: GalaxyNode = {
      id: `cap-${generateId()}`,
      type: 'capture',
      label: input.title,
      title: input.title,
      body: input.body,
      tags: input.tags,
      x: cx,
      y: cy,
      originX: cx,
      originY: cy,
      size: 8,
      color: bestMatch.color,
      glowIntensity: 0.8,
    };

    const conn: Connection = {
      id: `conn-${generateId()}`,
      from: bestMatch.id,
      to: captureNode.id,
      strength: 0.7,
    };

    // Update keyword glow
    const updatedNodes = state.nodes.map(n => {
      if (n.id === bestMatch.id) {
        const newCount = (n.captureCount || 0) + 1;
        return {
          ...n,
          captureCount: newCount,
          glowIntensity: Math.min(1, 0.3 + newCount * 0.15),
          size: Math.min(28, 18 + newCount * 1.5),
        };
      }
      return n;
    });

    set({
      nodes: [...updatedNodes, captureNode],
      connections: [...state.connections, conn],
      captureModalOpen: false,
    });
  },

  openCaptureModal: () => set({ captureModalOpen: true }),
  closeCaptureModal: () => set({ captureModalOpen: false }),
  selectNode: (node) => set({ selectedNode: node }),
  updateNodePosition: (id, x, y) => {
    set(state => ({
      nodes: state.nodes.map(n => n.id === id ? { ...n, x, y } : n),
    }));
  },
  resetNodePosition: (id) => {
    set(state => ({
      nodes: state.nodes.map(n => n.id === id ? { ...n, x: n.originX, y: n.originY } : n),
    }));
  },
}));
