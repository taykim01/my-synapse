import { useGalaxyStore, type GraphNode } from '@/stores/galaxyStore';
import { X, ExternalLink, Trash2, Pencil, Check, Loader2, ChevronDown, Plus, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface LinkMeta {
  title: string;
  thumbnail: string;
  description: string;
}

function LinkPreviewCard({ url }: { url: string }) {
  const [meta, setMeta] = useState<LinkMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMeta(null);
    supabase.functions.invoke('fetch-url-metadata', { body: { url } })
      .then(({ data }) => { if (!cancelled && data) setMeta({ title: data.title || '', thumbnail: data.thumbnail || '', description: data.description || '' }); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  const domain = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();

  if (loading) return (
    <div className="mb-4 rounded-xl border border-border bg-muted/50 p-4 animate-pulse">
      <div className="h-32 bg-muted rounded-lg mb-3" /><div className="h-4 bg-muted rounded w-3/4 mb-2" /><div className="h-3 bg-muted rounded w-1/2" />
    </div>
  );
  if (!meta || (!meta.thumbnail && !meta.title && !meta.description)) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block mb-4 rounded-xl border border-border bg-muted/50 overflow-hidden hover:border-primary/40 transition-colors group">
      {meta.thumbnail && (
        <div className="w-full h-36 overflow-hidden bg-muted">
          <img src={meta.thumbnail} alt={meta.title || 'Link preview'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}
      <div className="p-3">
        {meta.title && <h4 className="text-sm font-medium text-foreground line-clamp-2 mb-1">{meta.title}</h4>}
        {meta.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{meta.description}</p>}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><ExternalLink size={10} /><span>{domain}</span></div>
      </div>
    </a>
  );
}

function CaptureItem({ capture, onClick }: { capture: GraphNode; onClick: () => void }) {
  return (
    <div className="bg-muted/50 p-4 rounded-xl border border-border hover:bg-muted hover:border-secondary/50 cursor-pointer transition-all group" onClick={onClick}>
      <h4 className="text-foreground text-sm font-medium group-hover:text-secondary transition-colors">{capture.title}</h4>
      {capture.description && <p className="text-muted-foreground text-xs mt-1.5 line-clamp-2 leading-relaxed">{capture.description}</p>}
    </div>
  );
}

function MoveCapturePicker({ captureId, currentNodeId, onClose }: { captureId: string; currentNodeId: string; onClose: () => void }) {
  const nodes = useGalaxyStore(s => s.nodes);
  const moveCapture = useGalaxyStore(s => s.moveCapture);
  const [moving, setMoving] = useState(false);

  const targets = nodes.filter(n => (n.type === 'keyword' || n.type === 'detailed_keyword') && n.id !== currentNodeId);

  const handleMove = async (targetId: string) => {
    setMoving(true);
    const ok = await moveCapture(captureId, targetId);
    setMoving(false);
    if (ok) { toast({ title: '캡처가 이동되었습니다.' }); onClose(); }
    else toast({ title: '이동에 실패했습니다.', variant: 'destructive' });
  };

  return (
    <div className="mb-4 border border-border rounded-xl p-3 bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-foreground">이동할 키워드 선택</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1">
        {targets.map(t => (
          <button
            key={t.id}
            onClick={() => handleMove(t.id)}
            disabled={moving}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${t.type === 'keyword' ? 'bg-[#d946ef]' : 'bg-[#6366f1]'}`} />
            <span className="text-foreground truncate">{t.title}</span>
          </button>
        ))}
        {targets.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">이동 가능한 키워드가 없습니다.</p>}
      </div>
    </div>
  );
}

function MoveNodePicker({ nodeId, currentParentId, onClose }: { nodeId: string; currentParentId: string | null; onClose: () => void }) {
  const nodes = useGalaxyStore(s => s.nodes);
  const links = useGalaxyStore(s => s.links);
  const moveNode = useGalaxyStore(s => s.moveNode);
  const [moving, setMoving] = useState(false);

  // Collect all descendant IDs to prevent circular moves
  const getDescendants = (id: string): Set<string> => {
    const desc = new Set<string>();
    const children = links.filter(l => l.source === id).map(l => l.target);
    children.forEach(c => { desc.add(c); getDescendants(c).forEach(d => desc.add(d)); });
    return desc;
  };
  const descendants = getDescendants(nodeId);

  // Targets: "나" (center) + all keyword/DK nodes except self, current parent, and descendants
  const targets: { id: string; label: string; type: string }[] = [];
  const currentGraphParent = currentParentId || 'center';
  if (currentGraphParent !== 'center') {
    targets.push({ id: 'center', label: '나 (최상위)', type: 'center' });
  }
  nodes.filter(n => (n.type === 'keyword' || n.type === 'detailed_keyword') && n.id !== nodeId && n.id !== currentGraphParent && !descendants.has(n.id))
    .forEach(n => targets.push({ id: n.id, label: n.title, type: n.type }));

  const handleMove = async (targetId: string) => {
    setMoving(true);
    const parentId = targetId === 'center' ? null : targetId;
    const ok = await moveNode(nodeId, parentId);
    setMoving(false);
    if (ok) { toast({ title: '키워드가 이동되었습니다.' }); onClose(); }
    else toast({ title: '이동에 실패했습니다.', variant: 'destructive' });
  };

  return (
    <div className="mb-4 border border-border rounded-xl p-3 bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-foreground">이동할 위치 선택</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1">
        {targets.map(t => (
          <button
            key={t.id}
            onClick={() => handleMove(t.id)}
            disabled={moving}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${t.type === 'center' ? 'bg-[#22d3ee]' : t.type === 'keyword' ? 'bg-[#d946ef]' : 'bg-[#6366f1]'}`} />
            <span className="text-foreground truncate">{t.label}</span>
          </button>
        ))}
        {targets.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">이동 가능한 위치가 없습니다.</p>}
      </div>
    </div>
  );
}

function KeywordCaptureList({ keywordId, onSelectCapture }: { keywordId: string; onSelectCapture: (node: GraphNode) => void }) {
  const nodes = useGalaxyStore(s => s.nodes);
  const links = useGalaxyStore(s => s.links);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const detailedKeywords = nodes.filter(
    n => n.type === 'detailed_keyword' && links.some(l => l.source === keywordId && l.target === n.id)
  );
  const directCaptures = nodes.filter(
    n => n.type === 'capture' && links.some(l => l.source === keywordId && l.target === n.id)
  );
  const groupedCaptures = (dkId: string) =>
    nodes.filter(n => n.type === 'capture' && links.some(l => l.source === dkId && l.target === n.id));

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const totalCount = directCaptures.length + detailedKeywords.reduce((sum, dk) => sum + groupedCaptures(dk.id).length, 0);

  return (
    <div className="flex-1 overflow-y-auto mb-6 space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground mb-3 tracking-wider">연결된 캡처 목록</h3>
      {totalCount === 0 && detailedKeywords.length === 0 ? (
        <div className="text-center py-10 bg-muted/50 rounded-xl border border-dashed border-border">
          <p className="text-xs text-muted-foreground">아직 이 영역에 연결된 캡처가 없습니다.</p>
        </div>
      ) : (
        <>
          {detailedKeywords.map(dk => {
            const caps = groupedCaptures(dk.id);
            const isOpen = openGroups.has(dk.id);
            return (
              <div key={dk.id} className="rounded-xl border border-border overflow-hidden">
                <button onClick={() => toggleGroup(dk.id)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/60 transition-colors text-left">
                  <span className="text-sm font-medium text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#6366f1] shrink-0" />
                    {dk.title}
                    <span className="text-[10px] text-muted-foreground font-normal">({caps.length})</span>
                  </span>
                  <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && caps.length > 0 && (
                  <div className="p-2 space-y-2">
                    {caps.map(c => <CaptureItem key={c.id} capture={c} onClick={() => onSelectCapture(c)} />)}
                  </div>
                )}
              </div>
            );
          })}
          {directCaptures.map(c => <CaptureItem key={c.id} capture={c} onClick={() => onSelectCapture(c)} />)}
        </>
      )}
    </div>
  );
}

function CenterNodeList({ onSelectNode }: { onSelectNode: (node: GraphNode) => void }) {
  const nodes = useGalaxyStore(s => s.nodes);
  const links = useGalaxyStore(s => s.links);
  const addKeyword = useGalaxyStore(s => s.addKeyword);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [newKw, setNewKw] = useState('');
  const [adding, setAdding] = useState(false);

  const keywords = nodes.filter(n => n.type === 'keyword');
  const getDetailedKeywords = (kwId: string) => nodes.filter(n => n.type === 'detailed_keyword' && links.some(l => l.source === kwId && l.target === n.id));
  const getCaptures = (parentId: string) => nodes.filter(n => n.type === 'capture' && links.some(l => l.source === parentId && l.target === n.id));
  const toggleGroup = (id: string) => { setOpenGroups(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); };
  const totalCaptures = nodes.filter(n => n.type === 'capture').length;

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKw.trim()) return;
    setAdding(true);
    const ok = await addKeyword(newKw.trim());
    setAdding(false);
    if (ok) { toast({ title: `"${newKw.trim()}" 키워드가 추가되었습니다.` }); setNewKw(''); }
    else toast({ title: '키워드 추가에 실패했습니다.', variant: 'destructive' });
  };

  return (
    <div className="flex-1 overflow-y-auto mb-6 space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground tracking-wider">전체 구조</h3>
        <span className="text-[10px] text-muted-foreground">{keywords.length}개 키워드 · {totalCaptures}개 캡처</span>
      </div>

      {/* Add keyword form */}
      <form onSubmit={handleAddKeyword} className="flex gap-2 mb-3">
        <input
          type="text"
          value={newKw}
          onChange={e => setNewKw(e.target.value)}
          placeholder="새 키워드 추가"
          className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
        />
        <button type="submit" disabled={adding || !newKw.trim()} className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-secondary/90 disabled:opacity-50">
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        </button>
      </form>

      {keywords.map(kw => {
        const dks = getDetailedKeywords(kw.id);
        const directCaps = getCaptures(kw.id);
        const isOpen = openGroups.has(kw.id);
        const totalUnder = directCaps.length + dks.reduce((s, dk) => s + getCaptures(dk.id).length, 0);

        return (
          <div key={kw.id} className="rounded-xl border border-border overflow-hidden">
            <button onClick={() => toggleGroup(kw.id)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/60 transition-colors text-left">
              <span className="text-sm font-medium text-foreground flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#d946ef] shrink-0" />
                {kw.title}
                <span className="text-[10px] text-muted-foreground font-normal">({totalUnder})</span>
              </span>
              <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="p-2 space-y-2">
                {dks.map(dk => {
                  const dkCaps = getCaptures(dk.id);
                  const dkOpen = openGroups.has(dk.id);
                  return (
                    <div key={dk.id} className="rounded-lg border border-border/50 overflow-hidden ml-2">
                      <button onClick={() => toggleGroup(dk.id)} className="w-full flex items-center justify-between px-3 py-2 bg-muted/20 hover:bg-muted/40 transition-colors text-left">
                        <span className="text-xs font-medium text-foreground flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#6366f1] shrink-0" />
                          {dk.title}
                          <span className="text-[10px] text-muted-foreground font-normal">({dkCaps.length})</span>
                        </span>
                        <ChevronDown size={12} className={`text-muted-foreground transition-transform duration-200 ${dkOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {dkOpen && dkCaps.length > 0 && (
                        <div className="p-1.5 space-y-1.5">
                          {dkCaps.map(c => <CaptureItem key={c.id} capture={c} onClick={() => onSelectNode(c)} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {directCaps.map(c => <CaptureItem key={c.id} capture={c} onClick={() => onSelectNode(c)} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function NodeDetailPanel() {
  const selectedNode = useGalaxyStore(s => s.selectedNode);
  const activeNode = useGalaxyStore(s => s.activeNode);
  const setSelectedNode = useGalaxyStore(s => s.setSelectedNode);
  const deleteCapture = useGalaxyStore(s => s.deleteCapture);
  const updateCapture = useGalaxyStore(s => s.updateCapture);
  const updateNode = useGalaxyStore(s => s.updateNode);
  const deleteNode = useGalaxyStore(s => s.deleteNode);
  const addDetailedKeyword = useGalaxyStore(s => s.addDetailedKeyword);
  const [deleting, setDeleting] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [showMoveNodePicker, setShowMoveNodePicker] = useState(false);
  const [newDk, setNewDk] = useState('');
  const [addingDk, setAddingDk] = useState(false);

  const displayNode = activeNode;

  useEffect(() => {
    setIsEditingTitle(false);
    setIsEditingDesc(false);
    setShowMovePicker(false);
    setShowMoveNodePicker(false);
    setNewDk('');
  }, [displayNode?.id]);

  const handleSaveTitle = async () => {
    if (!displayNode?.dbId || !editTitle.trim()) return;
    setSaving(true);
    let ok: boolean;
    if (displayNode.type === 'capture') {
      ok = await updateCapture(displayNode.dbId, editTitle.trim(), displayNode.description);
    } else {
      ok = await updateNode(displayNode.dbId, editTitle.trim());
    }
    setSaving(false);
    if (ok) { toast({ title: '제목이 수정되었습니다.' }); setIsEditingTitle(false); }
    else toast({ title: '수정에 실패했습니다.', variant: 'destructive' });
  };

  const handleSaveDesc = async () => {
    if (!displayNode?.dbId) return;
    setSaving(true);
    const ok = await updateCapture(displayNode.dbId, displayNode.title, editDesc);
    setSaving(false);
    if (ok) { toast({ title: '내용이 수정되었습니다.' }); setIsEditingDesc(false); }
    else toast({ title: '수정에 실패했습니다.', variant: 'destructive' });
  };

  const handleDelete = async () => {
    if (!displayNode?.dbId) return;
    if (displayNode.type === 'capture') {
      if (!confirm('이 캡처를 삭제하시겠습니까?')) return;
      setDeleting(true);
      const ok = await deleteCapture(displayNode.dbId);
      setDeleting(false);
      if (ok) toast({ title: '캡처가 삭제되었습니다.' });
      else toast({ title: '삭제에 실패했습니다.', variant: 'destructive' });
    } else {
      if (!confirm(`"${displayNode.title}" 키워드를 삭제하시겠습니까? 하위 캡처는 "기타"로 이동됩니다.`)) return;
      setDeleting(true);
      const ok = await deleteNode(displayNode.dbId);
      setDeleting(false);
      if (ok) toast({ title: '키워드가 삭제되었습니다.' });
      else toast({ title: '삭제에 실패했습니다.', variant: 'destructive' });
    }
  };

  const isEditable = displayNode?.type === 'capture' || displayNode?.type === 'keyword' || displayNode?.type === 'detailed_keyword';

  return (
    <div
      className={`absolute top-4 right-4 bottom-4 w-80 md:w-96 z-40 bg-card/95 backdrop-blur-xl border border-border shadow-2xl p-6 flex flex-col rounded-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        selectedNode ? 'translate-x-0' : 'translate-x-[calc(100%+2rem)]'
      }`}
    >
      <div className="flex justify-between items-start mb-6">
        {isEditable && isEditingTitle ? (
          <div className="flex-1 pr-2 flex items-center gap-2">
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-lg font-display text-foreground focus:outline-none focus:border-primary"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSaveTitle()}
            />
            <button onClick={handleSaveTitle} disabled={saving} className="text-accent hover:text-accent/80 shrink-0">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pr-4 flex-1 min-w-0">
            <h2 className="text-xl font-display text-foreground truncate">{displayNode?.title}</h2>
            {isEditable && (
              <button onClick={() => { setEditTitle(displayNode?.title || ''); setIsEditingTitle(true); }} className="text-muted-foreground hover:text-foreground shrink-0" title="제목 수정">
                <Pencil size={14} />
              </button>
            )}
          </div>
        )}
        <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground shrink-0"><X size={20} /></button>
      </div>

      {displayNode?.type === 'capture' && (
        <>
          {displayNode.content_type && (
            <div className="mb-3">
              <span className="text-[10px] bg-accent/20 text-accent border border-accent/30 px-2 py-0.5 rounded">{displayNode.content_type}</span>
              {displayNode.source && <span className="text-[10px] text-muted-foreground ml-2">출처: {displayNode.source}</span>}
            </div>
          )}

          {displayNode.content_type === 'IMAGE' && displayNode.content_url && (
            <div className="mb-4 rounded-xl border border-border overflow-hidden">
              <img src={displayNode.content_url} alt={displayNode.title} className="w-full max-h-64 object-contain bg-muted/30" />
            </div>
          )}

          {displayNode.content_type === 'FILE' && displayNode.content_url && (
            <div className="mb-4">
              {displayNode.content_url.match(/\.(pdf)$/i) ? (
                <iframe src={displayNode.content_url} className="w-full h-64 rounded-xl border border-border" title={displayNode.title} />
              ) : (
                <a href={displayNode.content_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-muted/50 p-4 rounded-xl border border-border hover:bg-muted transition-colors">
                  <ExternalLink size={16} className="text-accent shrink-0" /><span className="text-sm text-foreground truncate">파일 열기</span>
                </a>
              )}
            </div>
          )}

          {displayNode.content_type === 'LINK' && displayNode.content_url && (
            <>
              <a href={displayNode.content_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mb-3 block truncate">{displayNode.content_url}</a>
              <LinkPreviewCard url={displayNode.content_url} />
            </>
          )}

          {/* Description — editable for ALL content types */}
          {isEditingDesc ? (
            <div className="flex-1 flex flex-col overflow-hidden mb-4">
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full flex-1 bg-muted/50 border border-border rounded-xl p-4 text-sm text-foreground focus:outline-none focus:border-primary resize-none" autoFocus />
              <div className="flex gap-2 mt-2 shrink-0">
                <button onClick={handleSaveDesc} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs hover:bg-accent/90 disabled:opacity-50">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} 저장
                </button>
                <button onClick={() => setIsEditingDesc(false)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">취소</button>
              </div>
            </div>
          ) : displayNode.description ? (
            <div className="flex-1 overflow-y-auto mb-4 group/desc relative">
              <p className="text-muted-foreground text-sm whitespace-pre-wrap leading-relaxed bg-muted/50 p-4 rounded-xl border border-border h-full">{displayNode.description}</p>
              <button onClick={() => { setEditDesc(displayNode.description || ''); setIsEditingDesc(true); }} className="absolute top-2 right-2 opacity-0 group-hover/desc:opacity-100 text-muted-foreground hover:text-foreground transition-opacity bg-card/80 rounded p-1" title="내용 수정">
                <Pencil size={12} />
              </button>
            </div>
          ) : (
            <div className="flex-1 mb-4">
              <button onClick={() => { setEditDesc(''); setIsEditingDesc(true); }} className="w-full text-center py-6 bg-muted/50 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">+ 메모 추가</button>
            </div>
          )}

          {displayNode.tags && displayNode.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-4 border-t border-border mb-4">
              {displayNode.tags.map((tag, idx) => (
                <span key={idx} className="bg-synapse-indigo/20 text-synapse-indigo border border-synapse-indigo/30 px-3 py-1.5 rounded-full text-xs shadow-[0_0_8px_hsl(239,84%,67%,0.3)]">#{tag}</span>
              ))}
            </div>
          )}

          {/* Bottom action buttons */}
          <div className="mt-auto space-y-2 pt-2">
            {showMovePicker ? (
              <MoveCapturePicker captureId={displayNode.id} currentNodeId={displayNode.connected_to || ''} onClose={() => setShowMovePicker(false)} />
            ) : (
              <button
                onClick={() => setShowMovePicker(true)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors text-sm"
              >
                <ArrowRight size={14} /> 다른 키워드로 이동
              </button>
            )}
            <button onClick={handleDelete} disabled={deleting} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors text-sm disabled:opacity-50">
              <Trash2 size={14} /> {deleting ? '삭제 중...' : '캡처 삭제'}
            </button>
          </div>
        </>
      )}

      {(displayNode?.type === 'keyword' || displayNode?.type === 'detailed_keyword') && (
        <>
          {/* Add DetailedKeyword form */}
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!newDk.trim() || !displayNode.id) return;
            setAddingDk(true);
            const ok = await addDetailedKeyword(newDk.trim(), displayNode.id);
            setAddingDk(false);
            if (ok) { toast({ title: `"${newDk.trim()}" 세부 키워드가 추가되었습니다.` }); setNewDk(''); }
            else toast({ title: '세부 키워드 추가에 실패했습니다.', variant: 'destructive' });
          }} className="flex gap-2 mb-3">
            <input
              type="text"
              value={newDk}
              onChange={e => setNewDk(e.target.value)}
              placeholder="새 세부 키워드 추가"
              className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
            />
            <button type="submit" disabled={addingDk || !newDk.trim()} className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-secondary/90 disabled:opacity-50">
              {addingDk ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            </button>
          </form>

          <KeywordCaptureList keywordId={displayNode.id} onSelectCapture={setSelectedNode} />

          {/* Bottom action buttons */}
          <div className="mt-auto space-y-2 pt-2">
            {showMoveNodePicker ? (
              <MoveNodePicker nodeId={displayNode.id} currentParentId={displayNode.connected_to || null} onClose={() => setShowMoveNodePicker(false)} />
            ) : (
              <button
                onClick={() => setShowMoveNodePicker(true)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors text-sm"
              >
                <ArrowRight size={14} /> 다른 위치로 이동
              </button>
            )}
            <button onClick={handleDelete} disabled={deleting} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors text-sm disabled:opacity-50">
              <Trash2 size={14} /> {deleting ? '삭제 중...' : '키워드 삭제'}
            </button>
          </div>
        </>
      )}

      {displayNode?.type === 'center' && (
        <CenterNodeList onSelectNode={setSelectedNode} />
      )}
    </div>
  );
}
