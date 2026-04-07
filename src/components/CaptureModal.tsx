import { useState, useRef, useEffect, useCallback } from 'react';
import { useGalaxyStore } from '@/stores/galaxyStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { X, ChevronDown, Type, Link, FileText, Image, Upload, Loader2, Sparkles } from 'lucide-react';

const CONTENT_TYPES = [
  { value: 'TEXT', label: '텍스트', icon: Type },
  { value: 'LINK', label: '링크', icon: Link },
  { value: 'FILE', label: '파일', icon: FileText },
  { value: 'IMAGE', label: '이미지', icon: Image },
] as const;

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

interface LinkMetadata {
  title: string;
  thumbnail: string;
  description: string;
  author?: string;
  keywords?: string[];
  category?: string;
  site_name?: string;
  type?: string;
}

export function CaptureModal() {
  const captureForm = useGalaxyStore(s => s.captureForm);
  const setCaptureForm = useGalaxyStore(s => s.setCaptureForm);
  const addCapture = useGalaxyStore(s => s.addCapture);
  const setIsAddingCapture = useGalaxyStore(s => s.setIsAddingCapture);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkPreview, setLinkPreview] = useState<LinkMetadata | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleGenPromiseRef = useRef<Promise<void> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const contentType = captureForm.content_type;
  const isText = contentType === 'TEXT';
  const isLink = contentType === 'LINK';
  const isFileOrImage = contentType === 'FILE' || contentType === 'IMAGE';

  const selectedType = CONTENT_TYPES.find(ct => ct.value === contentType) || CONTENT_TYPES[0];
  const SelectedIcon = selectedType.icon;

  const fetchMetadata = useCallback(async (url: string) => {
    if (!url) return;
    try {
      new URL(url);
    } catch {
      return;
    }

    setFetchingMeta(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-url-metadata', {
        body: { url },
      });
      if (!error && data) {
        setLinkPreview({
          title: data.title || '',
          thumbnail: data.thumbnail || '',
          description: data.description || '',
        });
        if (data.title) {
          setCaptureForm({ title: data.title });
        }
      }
    } catch (e) {
      console.error('Failed to fetch metadata:', e);
    } finally {
      setFetchingMeta(false);
    }
  }, [setCaptureForm]);

  const handleLinkChange = (url: string) => {
    setCaptureForm({ content_url: url, source: extractDomain(url) });
    setLinkPreview(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchMetadata(url);
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from('capture-files')
        .upload(filePath, file);

      if (error) {
        console.error('Upload failed:', error);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('capture-files')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      setCaptureForm({ content_url: publicUrl });

      // Auto-generate title for images via AI
      if (contentType === 'IMAGE') {
        setFetchingMeta(true);
        const promise = (async () => {
          try {
            const { data, error: aiError } = await supabase.functions.invoke('generate-image-title', {
              body: { image_url: publicUrl },
            });
            if (!aiError && data?.title) {
              setCaptureForm({ title: data.title });
            }
          } catch (err) {
            console.error('Image title generation failed:', err);
          } finally {
            setFetchingMeta(false);
            titleGenPromiseRef.current = null;
          }
        })();
        titleGenPromiseRef.current = promise;
      }

      // Auto-generate title for files via AI
      if (contentType === 'FILE') {
        setFetchingMeta(true);
        const promise = (async () => {
          try {
            const { data, error: aiError } = await supabase.functions.invoke('generate-file-title', {
              body: { file_url: publicUrl, file_name: file.name },
            });
            if (!aiError && data?.title) {
              setCaptureForm({ title: data.title });
            }
          } catch (err) {
            console.error('File title generation failed:', err);
          } finally {
            setFetchingMeta(false);
            titleGenPromiseRef.current = null;
          }
        })();
        titleGenPromiseRef.current = promise;
      }
    } finally {
      setUploading(false);
    }
  };

  const acceptTypes = contentType === 'IMAGE' ? 'image/*' : '*/*';

  return (
    <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-display text-foreground">새로운 캡처</h2>
          <button onClick={() => setIsAddingCapture(false)} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Content Type Dropdown */}
          <div className="relative">
            <label className="text-xs text-muted-foreground mb-2 block">입력 형식</label>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between bg-synapse-deep border border-border rounded-lg px-4 py-3 text-foreground hover:border-accent/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <SelectedIcon size={16} className="text-accent" />
                {selectedType.label}
              </span>
              <ChevronDown size={16} className={`text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 w-full mt-1 bg-card border border-border rounded-lg shadow-xl z-10 overflow-hidden">
                {CONTENT_TYPES.map(ct => {
                  const Icon = ct.icon;
                  return (
                    <button
                      key={ct.value}
                      onClick={() => {
                        setCaptureForm({ content_type: ct.value, content_url: '', source: '' });
                        setLinkPreview(null);
                        setDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-accent/10 transition-colors ${
                        contentType === ct.value ? 'text-accent bg-accent/5' : 'text-foreground'
                      }`}
                    >
                      <Icon size={16} />
                      {ct.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Link URL input */}
          {isLink && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">URL</label>
              <input
                type="url"
                placeholder="https://..."
                value={captureForm.content_url}
                onChange={e => handleLinkChange(e.target.value)}
                className="w-full bg-synapse-deep border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent transition-colors"
              />
              {captureForm.source && (
                <p className="text-xs text-accent mt-1">출처: {captureForm.source}</p>
              )}

              {/* Link Preview */}
              {fetchingMeta && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  메타데이터 가져오는 중...
                </div>
              )}
              {!fetchingMeta && linkPreview?.thumbnail && (
                <div className="mt-3 rounded-lg border border-border overflow-hidden bg-synapse-deep">
                  <img
                    src={linkPreview.thumbnail}
                    alt="Link preview"
                    className="w-full h-36 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  {linkPreview.description && (
                    <p className="px-3 py-2 text-xs text-muted-foreground line-clamp-2">{linkPreview.description}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="text-xs text-muted-foreground">제목</label>
              {!isText && (
                fetchingMeta ? (
                  <span className="text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                    <Sparkles size={10} />
                    AI가 제목을 생성 중...
                  </span>
                ) : (
                  <span className="text-[10px] text-synapse-indigo bg-synapse-indigo/10 px-2 py-0.5 rounded">
                    {isLink ? '링크에서 자동 추출' : 'AI 자동 생성'} · 수정 가능
                  </span>
                )
              )}
            </div>
            {isText ? (
              <input
                type="text"
                placeholder="어떤 정보인가요?"
                value={captureForm.title}
                onChange={e => setCaptureForm({ title: e.target.value })}
                className="w-full bg-synapse-deep border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent transition-colors"
              />
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder={isLink ? 'URL 입력 시 자동으로 제목을 가져옵니다' : '캡처 후 AI가 자동으로 제목을 생성합니다'}
                  value={captureForm.title}
                  onChange={e => setCaptureForm({ title: e.target.value })}
                  className="w-full bg-synapse-deep/50 border border-border/50 rounded-lg px-4 py-3 text-foreground/70 placeholder-muted-foreground/60 focus:outline-none focus:border-accent transition-colors italic"
                />
                {fetchingMeta && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
            )}
          </div>

          {/* File/Image upload */}
          {isFileOrImage && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {contentType === 'IMAGE' ? '이미지 업로드' : '파일 업로드'}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptTypes}
                onChange={handleFileUpload}
                className="hidden"
              />
              {captureForm.content_url ? (
                <div className="space-y-2">
                  {contentType === 'IMAGE' && (
                    <img src={captureForm.content_url} alt="preview" className="w-full h-32 object-cover rounded-lg border border-border" />
                  )}
                  <div className="flex items-center justify-between bg-synapse-deep border border-border rounded-lg px-4 py-3">
                    <span className="text-sm text-foreground truncate">업로드 완료</span>
                    <button
                      onClick={() => {
                        setCaptureForm({ content_url: '' });
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground ml-2"
                    >
                      변경
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 bg-synapse-deep border border-dashed border-border rounded-lg px-4 py-6 text-muted-foreground hover:border-accent/50 hover:text-foreground transition-colors"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      {contentType === 'IMAGE' ? '이미지 선택' : '파일 선택'}
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">메모</label>
            <textarea
              placeholder="세부 내용을 기록하세요."
              value={captureForm.description}
              onChange={e => setCaptureForm({ description: e.target.value })}
              rows={3}
              className="w-full bg-synapse-deep border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent resize-none transition-colors"
            />
          </div>

          {/* Source — only for LINK (auto-filled) */}
          {isLink && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">출처</label>
              <input
                type="text"
                placeholder="URL에서 자동 추출됩니다"
                value={captureForm.source}
                onChange={e => setCaptureForm({ source: e.target.value })}
                className="w-full bg-synapse-deep/50 border border-border/50 rounded-lg px-4 py-3 text-foreground/70 placeholder-muted-foreground/60 focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          )}
        </div>

        {saving && (
          <div className="mt-4 flex items-center gap-2 text-sm text-accent animate-pulse">
            <Sparkles size={16} className="animate-spin" />
            {fetchingMeta ? '제목을 생성하고 있습니다...' : 'AI가 관련 키워드를 찾고 있습니다...'}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setIsAddingCapture(false)} disabled={saving} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40">
            취소
          </button>
          <button
            onClick={async () => {
              setSaving(true);
              try {
                // Wait for title generation if still in progress
                if (titleGenPromiseRef.current) {
                  await titleGenPromiseRef.current;
                }
                const result = await addCapture();
                if (result?.keyword_title) {
                  toast({ title: '캡처 완료', description: `"${result.keyword_title}" 키워드에 연결되었습니다.` });
                }
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || (isText && !captureForm.title.trim()) || (!isText && !captureForm.content_url.trim())}
            className="px-6 py-2 text-sm bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors glow-accent disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                분석 중...
              </>
            ) : (
              '캡처 추가'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
