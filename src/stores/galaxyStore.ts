import { create } from 'zustand';

const generateId = () => Math.random().toString(36).substr(2, 9);
const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

export interface GraphNode {
  id: string;
  type: 'center' | 'keyword' | 'detailed_keyword' | 'capture';
  title: string;
  description?: string;
  content_type?: string;
  content_url?: string;
  source?: string;
  tags?: string[];
  connected_to?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

interface GalaxyState {
  gameState: 'onboarding' | 'exploring';
  nodes: GraphNode[];
  links: GraphLink[];
  selectedNode: GraphNode | null;
  activeNode: GraphNode | null;
  isAddingCapture: boolean;
  searchQuery: string;
  searchResults: GraphNode[];
  captureForm: { title: string; description: string; content_type: string; content_url: string; source: string; tag: string };

  startExploration: (keywords: string[]) => void;
  addCapture: () => void;
  setSelectedNode: (node: GraphNode | null) => void;
  setIsAddingCapture: (v: boolean) => void;
  setCaptureForm: (form: Partial<GalaxyState['captureForm']>) => void;
  handleSearch: (query: string) => void;
  getConnectedCaptures: (keywordId: string) => GraphNode[];
  openCaptureModal: () => void;
}

export const useGalaxyStore = create<GalaxyState>((set, get) => ({
  gameState: 'onboarding',
  nodes: [],
  links: [],
  selectedNode: null,
  activeNode: null,
  isAddingCapture: false,
  searchQuery: '',
  searchResults: [],
  captureForm: { title: '', description: '', content_type: 'TEXT', content_url: '', source: '', tag: '' },

  startExploration: (keywords: string[]) => {
    const validKeywords = keywords.filter(k => k.trim() !== '');
    if (validKeywords.length === 0) return;

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    const centerId = generateId();
    nodes.push({ id: centerId, type: 'center', title: '나의 우주', x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: 0 });

    validKeywords.forEach((kw, i) => {
      const id = generateId();
      const angle = (i / validKeywords.length) * Math.PI * 2;
      nodes.push({
        id, type: 'keyword', title: kw,
        x: Math.cos(angle) * 100, y: Math.sin(angle) * 100, vx: 0, vy: 0, fx: 0, fy: 0
      });
      links.push({ source: centerId, target: id });
    });

    set({ nodes, links, gameState: 'exploring' });
  },

  addCapture: () => {
    const state = get();
    const { captureForm, nodes, links } = state;
    const isText = captureForm.content_type === 'TEXT';
    if (isText && !captureForm.title.trim()) return;
    if (!isText && !captureForm.content_url.trim()) return;
    const title = captureForm.title.trim() || `${captureForm.content_type} 캡처 — ${new Date().toLocaleDateString('ko-KR')}`;

    const assignedTag = captureForm.tag || `AI_Tag_${Math.floor(Math.random() * 100)}`;
    const keywordNodes = nodes.filter(n => n.type === 'keyword');
    const targetKeyword = keywordNodes[Math.floor(Math.random() * keywordNodes.length)];
    if (!targetKeyword) return;

    const connectedLinks = links.filter(l => l.target === targetKeyword.id || l.source === targetKeyword.id);
    let targetId = targetKeyword.id;

    const newNodes = [...nodes];
    const newLinks = [...links];

    if (connectedLinks.length > 2 && Math.random() > 0.3) {
      const detailedId = generateId();
      newNodes.push({
        id: detailedId, type: 'detailed_keyword', title: `#${assignedTag}`,
        x: targetKeyword.x + randomRange(-20, 20), y: targetKeyword.y + randomRange(-20, 20),
        vx: 0, vy: 0, fx: 0, fy: 0
      });
      newLinks.push({ source: targetKeyword.id, target: detailedId });
      targetId = detailedId;
    }

    const parentNode = newNodes.find(n => n.id === targetId)!;
    const captureId = generateId();
    newNodes.push({
      id: captureId, type: 'capture', title,
      description: captureForm.description,
      content_type: captureForm.content_type,
      content_url: captureForm.content_url,
      source: captureForm.source,
      tags: [assignedTag],
      connected_to: targetId,
      x: parentNode.x + randomRange(-30, 30), y: parentNode.y + randomRange(-30, 30),
      vx: 0, vy: 0, fx: 0, fy: 0
    });
    newLinks.push({ source: targetId, target: captureId });

    set({
      nodes: newNodes,
      links: newLinks,
      captureForm: { title: '', description: '', content_type: 'TEXT', content_url: '', source: '', tag: '' },
      isAddingCapture: false,
    });
  },

  setSelectedNode: (node) => {
    set(state => ({
      selectedNode: node,
      activeNode: node || state.activeNode,
    }));
  },

  setIsAddingCapture: (v) => set({ isAddingCapture: v }),

  setCaptureForm: (form) => set(state => ({ captureForm: { ...state.captureForm, ...form } })),

  openCaptureModal: () => {
    set({
      isAddingCapture: true,
      captureForm: { title: '', description: '', content_type: 'TEXT', content_url: '', source: '', tag: 'AI제안_태그' },
    });
  },

  handleSearch: (query: string) => {
    const q = query.toLowerCase();
    set({ searchQuery: query });
    if (!q) {
      set({ searchResults: [] });
      return;
    }
    const results = get().nodes.filter(n =>
      n.type !== 'center' && (n.title.toLowerCase().includes(q) || (n.description && n.description.toLowerCase().includes(q)))
    );
    set({ searchResults: results });
  },

  getConnectedCaptures: (keywordId: string) => {
    const { nodes, links } = get();
    const targetIds = [keywordId];

    links.forEach(l => {
      if (l.source === keywordId) {
        const targetNode = nodes.find(n => n.id === l.target);
        if (targetNode && targetNode.type === 'detailed_keyword') {
          targetIds.push(targetNode.id);
        }
      }
    });

    const captures: GraphNode[] = [];
    links.forEach(l => {
      if (targetIds.includes(l.source)) {
        const targetNode = nodes.find(n => n.id === l.target);
        if (targetNode && targetNode.type === 'capture') {
          captures.push(targetNode);
        }
      }
    });
    return captures;
  },
}));
