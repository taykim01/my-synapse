import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

const generateId = () => Math.random().toString(36).substr(2, 9);

/** 캡처 간 유사도 임계값 — 이 값 이하이면 새 DetailedKeyword를 생성합니다 */
export const SIMILARITY_THRESHOLD = 0.15;
const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;
let _searchRequestId = 0;

export interface GraphNode {
  id: string;
  dbId?: string;
  type: "center" | "keyword" | "detailed_keyword" | "capture";
  title: string;
  description?: string;
  content_type?: string;
  content_url?: string;
  source?: string;
  tags?: string[];
  connected_to?: string;
  similarity?: number;
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
  gameState: "loading" | "onboarding" | "exploring";
  nodes: GraphNode[];
  links: GraphLink[];
  selectedNode: GraphNode | null;
  activeNode: GraphNode | null;
  isAddingCapture: boolean;
  searchQuery: string;
  searchResults: GraphNode[];
  captureForm: {
    title: string;
    description: string;
    content_type: string;
    content_url: string;
    source: string;
    tag: string;
    metadata: Record<string, unknown> | null;
  };

  initFromDB: () => Promise<void>;
  startExploration: (keywords: string[]) => Promise<void>;
  addCapture: () => Promise<{ keyword_id?: string; keyword_title?: string } | null>;
  setSelectedNode: (node: GraphNode | null) => void;
  setIsAddingCapture: (v: boolean) => void;
  setCaptureForm: (form: Partial<GalaxyState["captureForm"]>) => void;
  handleSearch: (query: string) => Promise<void>;
  getConnectedCaptures: (keywordId: string) => GraphNode[];
  deleteCapture: (captureId: string) => Promise<boolean>;
  openCaptureModal: () => void;
  backfillEmbeddings: () => Promise<{ processed: number; failed: number; total: number } | null>;
  updateCapture: (captureId: string, title: string, description?: string) => Promise<boolean>;
  addKeyword: (title: string) => Promise<boolean>;
  updateNode: (nodeId: string, title: string) => Promise<boolean>;
  deleteNode: (nodeId: string) => Promise<boolean>;
  moveCapture: (captureId: string, targetNodeId: string) => Promise<boolean>;
  moveNode: (nodeId: string, targetParentId: string | null) => Promise<boolean>;
  addDetailedKeyword: (title: string, parentId: string) => Promise<boolean>;
}

function buildGraphFromDB(
  dbNodes: { id: string; title: string; type: string; parent_id: string | null }[],
  dbCaptures: {
    id: string;
    title: string;
    description: string | null;
    content_type: string;
    content_url: string | null;
    source: string | null;
    connected_to: string | null;
  }[],
) {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  const centerId = "center";
  nodes.push({ id: centerId, type: "center", title: "나", x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: 0 });

  const keywords = dbNodes.filter((n) => n.type === "keyword" || !n.type);
  const detailedKeywords = dbNodes.filter((n) => n.type === "detailed_keyword");

  keywords.forEach((n, i) => {
    const angle = (i / keywords.length) * Math.PI * 2;
    nodes.push({
      id: n.id,
      dbId: n.id,
      type: "keyword",
      title: n.title,
      x: Math.cos(angle) * 100,
      y: Math.sin(angle) * 100,
      vx: 0, vy: 0, fx: 0, fy: 0,
    });
    links.push({ source: centerId, target: n.id });
  });

  detailedKeywords.forEach((n) => {
    const parentId = n.parent_id || centerId;
    const parent = nodes.find((nd) => nd.id === parentId);
    nodes.push({
      id: n.id,
      dbId: n.id,
      type: "detailed_keyword",
      title: n.title,
      connected_to: n.parent_id || undefined,
      x: (parent?.x || 0) + randomRange(-40, 40),
      y: (parent?.y || 0) + randomRange(-40, 40),
      vx: 0, vy: 0, fx: 0, fy: 0,
    });
    links.push({ source: parentId, target: n.id });
  });

  dbCaptures.forEach((c) => {
    const parentId = c.connected_to || (keywords.length > 0 ? keywords[0].id : centerId);
    const parent = nodes.find((n) => n.id === parentId);
    nodes.push({
      id: c.id,
      dbId: c.id,
      type: "capture",
      title: c.title,
      description: c.description || undefined,
      content_type: c.content_type,
      content_url: c.content_url || undefined,
      source: c.source || undefined,
      connected_to: c.connected_to || undefined,
      x: (parent?.x || 0) + randomRange(-30, 30),
      y: (parent?.y || 0) + randomRange(-30, 30),
      vx: 0, vy: 0, fx: 0, fy: 0,
    });
    links.push({ source: parentId, target: c.id });
  });

  return { nodes, links };
}

export const useGalaxyStore = create<GalaxyState>((set, get) => ({
  gameState: "loading",
  nodes: [],
  links: [],
  selectedNode: null,
  activeNode: null,
  isAddingCapture: false,
  searchQuery: "",
  searchResults: [],
  captureForm: { title: "", description: "", content_type: "TEXT", content_url: "", source: "", tag: "", metadata: null },

  initFromDB: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ gameState: "onboarding" }); return; }

    const { data: dbNodes } = await supabase
      .from("nodes")
      .select("id, title, type, parent_id, creator_id, created_at")
      .eq("creator_id", user.id);
    const { data: dbCaptures } = await supabase.from("captures").select("*").eq("creator_id", user.id);

    if (!dbNodes || dbNodes.filter((n) => n.type === "keyword" || !n.type).length === 0) {
      set({ gameState: "onboarding" });
      return;
    }

    const { nodes, links } = buildGraphFromDB(
      dbNodes.map((n) => ({ id: n.id, title: n.title, type: n.type || "keyword", parent_id: n.parent_id })),
      dbCaptures || [],
    );
    set({ nodes, links, gameState: "exploring" });
  },

  startExploration: async (keywords: string[]) => {
    const validKeywords = keywords.filter((k) => k.trim() !== "");
    if (validKeywords.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const allKeywords = [...validKeywords];
    if (!allKeywords.includes("기타")) allKeywords.push("기타");

    const rows = allKeywords.map((kw) => ({ title: kw, creator_id: user.id }));
    const { data: inserted, error } = await supabase.from("nodes").insert(rows).select();
    if (error || !inserted) { console.error("Failed to save nodes:", error); return; }

    const { nodes, links } = buildGraphFromDB(
      inserted.map((n) => ({ id: n.id, title: n.title, type: (n as any).type || "keyword", parent_id: (n as any).parent_id || null })),
      [],
    );
    set({ nodes, links, gameState: "exploring" });

    supabase.functions
      .invoke("generate-node-embeddings", { body: { node_ids: inserted.map((n) => n.id) } })
      .then(({ data, error: embError }) => {
        if (embError) console.error("Node embedding generation failed:", embError);
        else console.log(`Node embeddings generated:`, data);
      })
      .catch((e) => console.error("Node embedding generation error:", e));
  },

  addCapture: async () => {
    const state = get();
    const { captureForm, nodes, links } = state;
    const isText = captureForm.content_type === "TEXT";
    if (isText && !captureForm.title.trim()) return null;
    if (!isText && !captureForm.content_url.trim()) return null;
    const title = captureForm.title.trim() || `${captureForm.content_type} 캡처 — ${new Date().toLocaleDateString("ko-KR")}`;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: insertedCapture, error: insertError } = await supabase
      .from("captures")
      .insert({
        title,
        description: captureForm.description || null,
        content_type: captureForm.content_type,
        content_url: captureForm.content_url || null,
        source: captureForm.source || null,
        creator_id: user.id,
        connected_to: null,
      })
      .select()
      .single();

    if (insertError || !insertedCapture) { console.error("Failed to save capture:", insertError); return null; }

    let assignedKeywordId: string | null = null;
    let assignedKeywordTitle = "";
    try {
      const { data: aiResult, error: aiError } = await supabase.functions.invoke("assign-capture-keyword", {
        body: {
          capture_id: insertedCapture.id, title,
          description: captureForm.description || "",
          content_type: captureForm.content_type,
          content_url: captureForm.content_url || "",
          metadata: captureForm.metadata || undefined,
        },
      });
      if (!aiError && aiResult?.keyword_id) {
        assignedKeywordId = aiResult.keyword_id;
        assignedKeywordTitle = aiResult.keyword_title || "";
      }
    } catch (e) { console.error("AI keyword assignment failed:", e); }

    const targetId = assignedKeywordId || nodes.find((n) => n.type === "keyword")?.id;
    if (!targetId) return null;

    let parentNode = nodes.find((n) => n.id === targetId);
    const newNodes = [...nodes];
    const newLinks = [...links];

    if (!parentNode && assignedKeywordId) {
      const centerId = "center";
      const centerNode = nodes.find((n) => n.id === centerId);
      const newKeywordNode: GraphNode = {
        id: assignedKeywordId, dbId: assignedKeywordId, type: "keyword", title: assignedKeywordTitle,
        x: (centerNode?.x || 0) + randomRange(-80, 80), y: (centerNode?.y || 0) + randomRange(-80, 80),
        vx: 0, vy: 0, fx: 0, fy: 0,
      };
      newNodes.push(newKeywordNode);
      newLinks.push({ source: centerId, target: assignedKeywordId });
      parentNode = newKeywordNode;
    }

    newNodes.push({
      id: insertedCapture.id, dbId: insertedCapture.id, type: "capture", title,
      description: captureForm.description, content_type: captureForm.content_type,
      content_url: captureForm.content_url, source: captureForm.source, connected_to: targetId,
      x: (parentNode?.x || 0) + randomRange(-30, 30), y: (parentNode?.y || 0) + randomRange(-30, 30),
      vx: 0, vy: 0, fx: 0, fy: 0,
    });
    newLinks.push({ source: targetId, target: insertedCapture.id });

    set({
      nodes: newNodes, links: newLinks,
      captureForm: { title: "", description: "", content_type: "TEXT", content_url: "", source: "", tag: "", metadata: null },
      isAddingCapture: false,
    });

    supabase.functions
      .invoke("check-capture-similarity", {
        body: { capture_id: insertedCapture.id, node_id: targetId, threshold: SIMILARITY_THRESHOLD },
      })
      .then(({ data: simResult, error: simError }) => {
        if (simError || !simResult?.created) return;
        const dk = simResult.detailed_keyword;
        const movedIds: string[] = simResult.moved_capture_ids || [];

        set((state) => {
          const updatedNodes = [...state.nodes];
          const updatedLinks = [...state.links];
          const parentGraphNode = updatedNodes.find((n) => n.id === dk.parent_id);
          updatedNodes.push({
            id: dk.id, dbId: dk.id, type: "detailed_keyword", title: dk.title, connected_to: dk.parent_id,
            x: (parentGraphNode?.x || 0) + randomRange(-40, 40), y: (parentGraphNode?.y || 0) + randomRange(-40, 40),
            vx: 0, vy: 0, fx: 0, fy: 0,
          });
          updatedLinks.push({ source: dk.parent_id, target: dk.id });

          movedIds.forEach((captureId) => {
            const captureNode = updatedNodes.find((n) => n.id === captureId);
            if (captureNode) captureNode.connected_to = dk.id;
            const oldLinkIdx = updatedLinks.findIndex((l) => l.target === captureId);
            if (oldLinkIdx >= 0) updatedLinks.splice(oldLinkIdx, 1);
            updatedLinks.push({ source: dk.id, target: captureId });
          });

          return { nodes: updatedNodes, links: updatedLinks };
        });
        console.log(`DetailedKeyword created: "${dk.title}", moved ${movedIds.length} captures`);
      })
      .catch((e) => console.error("Similarity check failed:", e));

    return { keyword_id: assignedKeywordId || undefined, keyword_title: assignedKeywordTitle || undefined };
  },

  setSelectedNode: (node) => set((state) => ({ selectedNode: node, activeNode: node || state.activeNode })),
  setIsAddingCapture: (v) => set({ isAddingCapture: v }),
  setCaptureForm: (form) => set((state) => ({ captureForm: { ...state.captureForm, ...form } })),

  openCaptureModal: () => {
    set({
      isAddingCapture: true,
      captureForm: { title: "", description: "", content_type: "TEXT", content_url: "", source: "", tag: "AI제안_태그", metadata: null },
    });
  },

  handleSearch: async (query: string) => {
    const q = query.trim();
    set({ searchQuery: query });
    if (!q) { set({ searchResults: [] }); return; }

    const requestId = ++_searchRequestId;
    const localResults = get().nodes.filter(
      (n) => n.type !== "center" && (n.title.toLowerCase().includes(q.toLowerCase()) || (n.description && n.description.toLowerCase().includes(q.toLowerCase()))),
    );
    set({ searchResults: localResults });

    try {
      const { data, error } = await supabase.functions.invoke("search-captures", { body: { query: q } });
      if (_searchRequestId !== requestId) return;
      if (error || !data) return;

      const { text_results = [], semantic_results = [] } = data;
      const seen = new Set<string>();
      const merged: GraphNode[] = [];
      const existingNodes = get().nodes;

      for (const r of text_results) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          const existing = existingNodes.find((n) => n.id === r.id);
          if (existing) merged.push(existing);
          else merged.push({ id: r.id, dbId: r.id, type: "capture", title: r.title, description: r.description || undefined, content_type: r.content_type, content_url: r.content_url || undefined, source: r.source || undefined, connected_to: r.connected_to || undefined, x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: 0 });
        }
      }

      for (const r of semantic_results) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          const existing = existingNodes.find((n) => n.id === r.id);
          if (existing) merged.push({ ...existing, similarity: r.similarity });
          else merged.push({ id: r.id, dbId: r.id, type: "capture", title: r.title, description: r.description || undefined, content_type: r.content_type, similarity: r.similarity, x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: 0 });
        }
      }

      const keywordMatches = existingNodes.filter(
        (n) => n.type === "keyword" && n.title.toLowerCase().includes(q.toLowerCase()) && !seen.has(n.id),
      );
      set({ searchResults: [...merged, ...keywordMatches] });
    } catch (e) { console.error("Server search failed, using local results:", e); }
  },

  getConnectedCaptures: (keywordId: string) => {
    const { nodes, links } = get();
    const targetIds = [keywordId];
    links.forEach((l) => {
      if (l.source === keywordId) {
        const targetNode = nodes.find((n) => n.id === l.target);
        if (targetNode && targetNode.type === "detailed_keyword") targetIds.push(targetNode.id);
      }
    });
    const captures: GraphNode[] = [];
    links.forEach((l) => {
      if (targetIds.includes(l.source)) {
        const targetNode = nodes.find((n) => n.id === l.target);
        if (targetNode && targetNode.type === "capture") captures.push(targetNode);
      }
    });
    return captures;
  },

  deleteCapture: async (captureId: string) => {
    const { error } = await supabase.from("captures").delete().eq("id", captureId);
    if (error) { console.error("Failed to delete capture:", error); return false; }
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== captureId),
      links: state.links.filter((l) => l.source !== captureId && l.target !== captureId),
      selectedNode: state.selectedNode?.id === captureId ? null : state.selectedNode,
    }));
    return true;
  },

  backfillEmbeddings: async () => {
    try {
      const { data, error } = await supabase.functions.invoke("backfill-embeddings", { body: {} });
      if (error) { console.error("Backfill error:", error); return null; }
      return data as { processed: number; failed: number; total: number };
    } catch (e) { console.error("Backfill error:", e); return null; }
  },

  updateCapture: async (captureId: string, title: string, description?: string) => {
    try {
      const { error } = await supabase.functions.invoke("update-capture", {
        body: { capture_id: captureId, title, description },
      });
      if (error) { console.error("Update capture error:", error); return false; }
      set((state) => ({
        nodes: state.nodes.map((n) => n.id === captureId ? { ...n, title, description: description ?? n.description } : n),
        selectedNode: state.selectedNode?.id === captureId ? { ...state.selectedNode, title, description: description ?? state.selectedNode.description } : state.selectedNode,
        activeNode: state.activeNode?.id === captureId ? { ...state.activeNode, title, description: description ?? state.activeNode.description } : state.activeNode,
      }));
      return true;
    } catch (e) { console.error("Update capture error:", e); return false; }
  },

  addKeyword: async (title: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: inserted, error } = await supabase
      .from("nodes")
      .insert({ title, creator_id: user.id, type: "keyword" })
      .select()
      .single();
    if (error || !inserted) { console.error("Failed to add keyword:", error); return false; }

    set((state) => {
      const centerNode = state.nodes.find((n) => n.type === "center");
      const angle = Math.random() * Math.PI * 2;
      return {
        nodes: [...state.nodes, {
          id: inserted.id, dbId: inserted.id, type: "keyword" as const, title,
          x: (centerNode?.x || 0) + Math.cos(angle) * 100, y: (centerNode?.y || 0) + Math.sin(angle) * 100,
          vx: 0, vy: 0, fx: 0, fy: 0,
        }],
        links: [...state.links, { source: "center", target: inserted.id }],
      };
    });

    // Generate embedding for the new keyword
    supabase.functions.invoke("generate-node-embeddings", { body: { node_ids: [inserted.id] } }).catch(console.error);
    return true;
  },

  updateNode: async (nodeId: string, title: string) => {
    const { error } = await supabase.from("nodes").update({ title }).eq("id", nodeId);
    if (error) { console.error("Failed to update node:", error); return false; }

    set((state) => ({
      nodes: state.nodes.map((n) => n.id === nodeId ? { ...n, title } : n),
      selectedNode: state.selectedNode?.id === nodeId ? { ...state.selectedNode, title } : state.selectedNode,
      activeNode: state.activeNode?.id === nodeId ? { ...state.activeNode, title } : state.activeNode,
    }));

    // Regenerate embedding with new title
    supabase.functions.invoke("generate-node-embeddings", { body: { node_ids: [nodeId] } }).catch(console.error);
    return true;
  },

  deleteNode: async (nodeId: string) => {
    const { nodes, links } = get();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.type === "center") return false;

    // Find all captures under this node (direct + through child detailed_keywords)
    const childDkIds = nodes.filter((n) => n.type === "detailed_keyword" && links.some((l) => l.source === nodeId && l.target === n.id)).map((n) => n.id);
    const allParentIds = [nodeId, ...childDkIds];
    const capturesUnder = nodes.filter((n) => n.type === "capture" && allParentIds.includes(n.connected_to || ""));

    // Move captures to "기타" if they exist
    if (capturesUnder.length > 0) {
      const miscNode = nodes.find((n) => n.type === "keyword" && n.title === "기타");
      if (miscNode) {
        await supabase.from("captures").update({ connected_to: miscNode.id }).in("id", capturesUnder.map((c) => c.id));
      }
    }

    // Delete child detailed_keywords first
    if (childDkIds.length > 0) {
      await supabase.from("nodes").delete().in("id", childDkIds);
    }

    const { error } = await supabase.from("nodes").delete().eq("id", nodeId);
    if (error) { console.error("Failed to delete node:", error); return false; }

    set((state) => {
      const removedIds = new Set([nodeId, ...childDkIds]);
      const miscNode = state.nodes.find((n) => n.type === "keyword" && n.title === "기타");
      let updatedNodes = state.nodes.filter((n) => !removedIds.has(n.id));
      let updatedLinks = state.links.filter((l) => !removedIds.has(l.source) && !removedIds.has(l.target));

      // Re-link moved captures to 기타
      if (miscNode) {
        updatedNodes = updatedNodes.map((n) => {
          if (n.type === "capture" && allParentIds.includes(n.connected_to || "")) {
            return { ...n, connected_to: miscNode.id };
          }
          return n;
        });
        capturesUnder.forEach((c) => {
          updatedLinks.push({ source: miscNode.id, target: c.id });
        });
      }

      return {
        nodes: updatedNodes,
        links: updatedLinks,
        selectedNode: state.selectedNode?.id === nodeId ? null : state.selectedNode,
      };
    });
    return true;
  },

  moveCapture: async (captureId: string, targetNodeId: string) => {
    const { error } = await supabase.from("captures").update({ connected_to: targetNodeId }).eq("id", captureId);
    if (error) { console.error("Failed to move capture:", error); return false; }

    set((state) => {
      const updatedLinks = state.links.filter((l) => l.target !== captureId);
      updatedLinks.push({ source: targetNodeId, target: captureId });
      return {
        nodes: state.nodes.map((n) => n.id === captureId ? { ...n, connected_to: targetNodeId } : n),
        links: updatedLinks,
        selectedNode: state.selectedNode?.id === captureId ? { ...state.selectedNode, connected_to: targetNodeId } : state.selectedNode,
        activeNode: state.activeNode?.id === captureId ? { ...state.activeNode, connected_to: targetNodeId } : state.activeNode,
      };
    });
    return true;
  },

  moveNode: async (nodeId: string, targetParentId: string | null) => {
    const { nodes, links } = get();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.type === "center") return false;

    // Update parent_id in DB
    const newParentId = targetParentId === "center" ? null : targetParentId;
    const newType = newParentId === null ? "keyword" : "detailed_keyword";

    const { error } = await supabase.from("nodes").update({ parent_id: newParentId, type: newType }).eq("id", nodeId);
    if (error) { console.error("Failed to move node:", error); return false; }

    // If becoming a keyword from DK, also update children DKs' embeddings
    const childDkIds = nodes.filter((n) => n.type === "detailed_keyword" && links.some((l) => l.source === nodeId && l.target === n.id)).map((n) => n.id);

    set((state) => {
      const graphParentId = targetParentId || "center";
      const parentNode = state.nodes.find((n) => n.id === graphParentId);
      const updatedLinks = state.links.filter((l) => l.target !== nodeId);
      updatedLinks.push({ source: graphParentId, target: nodeId });

      return {
        nodes: state.nodes.map((n) => n.id === nodeId ? {
          ...n, type: newType as any, connected_to: newParentId || undefined,
          x: (parentNode?.x || 0) + randomRange(-60, 60),
          y: (parentNode?.y || 0) + randomRange(-60, 60),
        } : n),
        links: updatedLinks,
        selectedNode: state.selectedNode?.id === nodeId ? { ...state.selectedNode, type: newType as any } : state.selectedNode,
        activeNode: state.activeNode?.id === nodeId ? { ...state.activeNode, type: newType as any } : state.activeNode,
      };
    });

    // Regenerate embeddings for moved node and its children
    const idsToReembed = [nodeId, ...childDkIds];
    supabase.functions.invoke("generate-node-embeddings", { body: { node_ids: idsToReembed } }).catch(console.error);
    return true;
  },

  addDetailedKeyword: async (title: string, parentId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: inserted, error } = await supabase
      .from("nodes")
      .insert({ title, creator_id: user.id, type: "detailed_keyword", parent_id: parentId })
      .select()
      .single();
    if (error || !inserted) { console.error("Failed to add detailed keyword:", error); return false; }

    set((state) => {
      const parentNode = state.nodes.find((n) => n.id === parentId);
      return {
        nodes: [...state.nodes, {
          id: inserted.id, dbId: inserted.id, type: "detailed_keyword" as const, title,
          connected_to: parentId,
          x: (parentNode?.x || 0) + randomRange(-40, 40),
          y: (parentNode?.y || 0) + randomRange(-40, 40),
          vx: 0, vy: 0, fx: 0, fy: 0,
        }],
        links: [...state.links, { source: parentId, target: inserted.id }],
      };
    });

    supabase.functions.invoke("generate-node-embeddings", { body: { node_ids: [inserted.id] } }).catch(console.error);
    return true;
  },
}));
