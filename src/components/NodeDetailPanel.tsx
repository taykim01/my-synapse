import { useGalaxyStore } from '@/stores/galaxyStore';
import { X, ExternalLink, Trash2 } from 'lucide-react';
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
      .then(({ data }) => {
        if (!cancelled && data) {
          setMeta({ title: data.title || '', thumbnail: data.thumbnail || '', description: data.description || '' });
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [url]);

  const domain = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();

  if (loading) {
    return (
      <div className="mb-4 rounded-xl border border-border bg-muted/50 p-4 animate-pulse">
        <div className="h-32 bg-muted rounded-lg mb-3" />
        <div className="h-4 bg-muted rounded w-3/4 mb-2" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </div>
    );
  }

  if (!meta || (!meta.thumbnail && !meta.title && !meta.description)) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mb-4 rounded-xl border border-border bg-muted/50 overflow-hidden hover:border-primary/40 transition-colors group"
    >
      {meta.thumbnail && (
        <div className="w-full h-36 overflow-hidden bg-muted">
          <img
            src={meta.thumbnail}
            alt={meta.title || 'Link preview'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <div className="p-3">
        {meta.title && (
          <h4 className="text-sm font-medium text-foreground line-clamp-2 mb-1">{meta.title}</h4>
        )}
        {meta.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{meta.description}</p>
        )}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <ExternalLink size={10} />
          <span>{domain}</span>
        </div>
      </div>
    </a>
  );
}

export function NodeDetailPanel() {
  const selectedNode = useGalaxyStore(s => s.selectedNode);
  const activeNode = useGalaxyStore(s => s.activeNode);
  const setSelectedNode = useGalaxyStore(s => s.setSelectedNode);
  const getConnectedCaptures = useGalaxyStore(s => s.getConnectedCaptures);
  const deleteCapture = useGalaxyStore(s => s.deleteCapture);
  const [deleting, setDeleting] = useState(false);

  const displayNode = activeNode;

  const handleDelete = async () => {
    if (!displayNode?.dbId) return;
    if (!confirm('이 캡처를 삭제하시겠습니까?')) return;
    setDeleting(true);
    const ok = await deleteCapture(displayNode.dbId);
    setDeleting(false);
    if (ok) {
      toast({ title: '캡처가 삭제되었습니다.' });
    } else {
      toast({ title: '삭제에 실패했습니다.', variant: 'destructive' });
    }
  };

  return (
    <div
      className={`absolute top-4 right-4 bottom-4 w-80 md:w-96 z-40 bg-card/95 backdrop-blur-xl border border-border shadow-2xl p-6 flex flex-col rounded-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        selectedNode ? 'translate-x-0' : 'translate-x-[calc(100%+2rem)]'
      }`}
    >
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-xl font-display text-foreground pr-4">{displayNode?.title}</h2>
        <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground shrink-0">
          <X size={20} />
        </button>
      </div>

      {displayNode?.type === 'capture' && (
        <>
          {displayNode.content_type && (
            <div className="mb-3">
              <span className="text-[10px] bg-accent/20 text-accent border border-accent/30 px-2 py-0.5 rounded">
                {displayNode.content_type}
              </span>
              {displayNode.source && (
                <span className="text-[10px] text-muted-foreground ml-2">출처: {displayNode.source}</span>
              )}
            </div>
          )}

          {displayNode.content_url && (
            <a
              href={displayNode.content_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mb-3 block truncate"
            >
              {displayNode.content_url}
            </a>
          )}

          {displayNode.content_type === 'LINK' && displayNode.content_url && (
            <LinkPreviewCard url={displayNode.content_url} />
          )}

          {displayNode.description && (
            <div className="flex-1 overflow-y-auto mb-6">
              <p className="text-muted-foreground text-sm whitespace-pre-wrap leading-relaxed bg-muted/50 p-4 rounded-xl border border-border">
                {displayNode.description}
              </p>
            </div>
          )}

          {displayNode.tags && displayNode.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
              {displayNode.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="bg-synapse-indigo/20 text-synapse-indigo border border-synapse-indigo/30 px-3 py-1.5 rounded-full text-xs shadow-[0_0_8px_hsl(239,84%,67%,0.3)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors text-sm disabled:opacity-50"
          >
            <Trash2 size={14} />
            {deleting ? '삭제 중...' : '캡처 삭제'}
          </button>
        </>
      )}

      {displayNode?.type === 'keyword' && (
        <div className="flex-1 overflow-y-auto mb-6 space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 tracking-wider">연결된 캡처 목록</h3>
          {getConnectedCaptures(displayNode.id).length > 0 ? (
            getConnectedCaptures(displayNode.id).map(capture => (
              <div
                key={capture.id}
                className="bg-muted/50 p-4 rounded-xl border border-border hover:bg-muted hover:border-secondary/50 cursor-pointer transition-all group"
                onClick={() => setSelectedNode(capture)}
              >
                <h4 className="text-foreground text-sm font-medium group-hover:text-secondary transition-colors">{capture.title}</h4>
                {capture.description && <p className="text-muted-foreground text-xs mt-1.5 line-clamp-2 leading-relaxed">{capture.description}</p>}
              </div>
            ))
          ) : (
            <div className="text-center py-10 bg-muted/50 rounded-xl border border-dashed border-border">
              <p className="text-xs text-muted-foreground">아직 이 영역에 연결된 캡처가 없습니다.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
