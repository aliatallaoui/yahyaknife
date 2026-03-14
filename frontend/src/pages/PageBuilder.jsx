import { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Save, Eye, Rocket, Pause, Settings, Layers,
  GripVertical, Plus, Trash2, EyeOff, Copy,
  Image, Type, Video, Star, HelpCircle, Shield, Clock, Truck,
  AlertTriangle, MessageSquare, ShoppingCart, Zap, Monitor, Smartphone,
  FormInput, X, Maximize2, Minimize2, ExternalLink,
  ChevronRight
} from 'lucide-react';
import clsx from 'clsx';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import toast from 'react-hot-toast';
import BlockEditor from '../components/sales-channels/BlockEditor';
import PagePreview from '../components/sales-channels/PagePreview';
import PageSettings from '../components/sales-channels/PageSettings';

// Block categories with their block types
const BLOCK_CATEGORIES = [
  {
    id: 'essential',
    label: 'Essential',
    color: 'blue',
    blocks: [
      { type: 'hero', label: 'Hero Section', icon: Zap, color: 'blue' },
      { type: 'productGallery', label: 'Product Gallery', icon: Image, color: 'purple' },
      { type: 'variantSelector', label: 'Variant Selector', icon: Layers, color: 'indigo' },
      { type: 'codForm', label: 'COD Order Form', icon: FormInput, color: 'green' },
    ]
  },
  {
    id: 'content',
    label: 'Content',
    color: 'purple',
    blocks: [
      { type: 'text', label: 'Text Block', icon: Type, color: 'gray' },
      { type: 'image', label: 'Image', icon: Image, color: 'pink' },
      { type: 'video', label: 'Video', icon: Video, color: 'red' },
      { type: 'benefits', label: 'Benefits', icon: Star, color: 'amber' },
    ]
  },
  {
    id: 'social',
    label: 'Social Proof',
    color: 'teal',
    blocks: [
      { type: 'testimonials', label: 'Testimonials', icon: MessageSquare, color: 'teal' },
      { type: 'reviews', label: 'Reviews', icon: Star, color: 'yellow' },
      { type: 'faq', label: 'FAQ', icon: HelpCircle, color: 'sky' },
    ]
  },
  {
    id: 'conversion',
    label: 'Conversion',
    color: 'emerald',
    blocks: [
      { type: 'cta', label: 'Call to Action', icon: ShoppingCart, color: 'emerald' },
      { type: 'countdown', label: 'Countdown Timer', icon: Clock, color: 'red' },
      { type: 'stockScarcity', label: 'Stock Scarcity', icon: AlertTriangle, color: 'amber' },
      { type: 'guarantee', label: 'Guarantee Badge', icon: Shield, color: 'blue' },
      { type: 'trustBadges', label: 'Trust Badges', icon: Shield, color: 'green' },
      { type: 'deliveryInfo', label: 'Delivery Info', icon: Truck, color: 'orange' },
    ]
  },
  {
    id: 'layout',
    label: 'Layout',
    color: 'gray',
    blocks: [
      { type: 'spacer', label: 'Spacer', icon: Layers, color: 'gray' },
    ]
  }
];

// Flat list for lookups
const BLOCK_TYPES = BLOCK_CATEGORIES.flatMap(cat => cat.blocks);

// Color map for block icons in the list
const ICON_COLOR_MAP = {
  blue: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30',
  purple: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30',
  amber: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30',
  indigo: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30',
  green: 'text-green-500 bg-green-50 dark:bg-green-900/30',
  gray: 'text-gray-500 bg-gray-100 dark:bg-gray-700',
  pink: 'text-pink-500 bg-pink-50 dark:bg-pink-900/30',
  red: 'text-red-500 bg-red-50 dark:bg-red-900/30',
  teal: 'text-teal-500 bg-teal-50 dark:bg-teal-900/30',
  yellow: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/30',
  sky: 'text-sky-500 bg-sky-50 dark:bg-sky-900/30',
  emerald: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30',
  orange: 'text-orange-500 bg-orange-50 dark:bg-orange-900/30',
};

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export default function PageBuilder() {
  const { t } = useTranslation();
  const { channelId, pageId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useContext(AuthContext);

  const [page, setPage] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activePanel, setActivePanel] = useState('blocks');
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [previewMode, setPreviewMode] = useState('desktop');
  const [dragIndex, setDragIndex] = useState(null);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);

  const fetchPage = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/sales-channels/${channelId}/pages/${pageId}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data ?? json;
        setPage(data);
        setBlocks(data.blocks || []);
      }
    } catch {
      toast.error('Failed to load page');
    } finally { setLoading(false); }
  }, [channelId, pageId]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/sales-channels/${channelId}/pages/${pageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks })
      });
      if (res.ok) {
        toast.success(t('common.saved', 'Saved'));
        setDirty(false);
        const json = await res.json();
        setPage(json.data ?? json);
      } else {
        toast.error('Save failed');
      }
    } catch { toast.error('Save failed'); }
    setSaving(false);
  }, [saving, channelId, pageId, blocks, t]);

  // Auto-save on Ctrl+S
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleSave]);

  // Escape to close fullscreen preview
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && fullscreenPreview) setFullscreenPreview(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [fullscreenPreview]);

  const handleSaveSettings = async (settings) => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/sales-channels/${channelId}/pages/${pageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        toast.success(t('common.saved', 'Saved'));
        const json = await res.json();
        setPage(json.data ?? json);
      }
    } catch { toast.error('Save failed'); }
    setSaving(false);
  };

  const handlePublish = async () => {
    const res = await apiFetch(`/api/sales-channels/${channelId}/pages/${pageId}/publish`, { method: 'POST' });
    if (res.ok) {
      toast.success(t('salesChannels.pagePublished', 'Page published!'));
      fetchPage();
    }
  };

  const handleUnpublish = async () => {
    const res = await apiFetch(`/api/sales-channels/${channelId}/pages/${pageId}/unpublish`, { method: 'POST' });
    if (res.ok) {
      toast.success(t('salesChannels.pageUnpublished', 'Page unpublished'));
      fetchPage();
    }
  };

  // Block management
  const updateBlocks = (newBlocks) => {
    setBlocks(newBlocks);
    setDirty(true);
  };

  const addBlock = (type) => {
    const newBlock = {
      id: generateId(),
      type,
      settings: getDefaultSettings(type),
      isVisible: true
    };
    updateBlocks([...blocks, newBlock]);
    setSelectedBlock(newBlock.id);
    setShowAddBlock(false);
  };

  const duplicateBlock = (blockId) => {
    const source = blocks.find(b => b.id === blockId);
    if (!source) return;
    const idx = blocks.indexOf(source);
    const clone = { ...source, id: generateId(), settings: { ...source.settings } };
    // Deep clone arrays in settings
    Object.keys(clone.settings).forEach(k => {
      if (Array.isArray(clone.settings[k])) {
        clone.settings[k] = clone.settings[k].map(item =>
          typeof item === 'object' ? { ...item } : item
        );
      }
    });
    const updated = [...blocks];
    updated.splice(idx + 1, 0, clone);
    updateBlocks(updated);
    setSelectedBlock(clone.id);
  };

  const removeBlock = (blockId) => {
    updateBlocks(blocks.filter(b => b.id !== blockId));
    if (selectedBlock === blockId) setSelectedBlock(null);
  };

  const toggleBlockVisibility = (blockId) => {
    updateBlocks(blocks.map(b => b.id === blockId ? { ...b, isVisible: !b.isVisible } : b));
  };

  const moveBlock = (fromIdx, toIdx) => {
    const updated = [...blocks];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    updateBlocks(updated);
  };

  const updateBlockSettings = (blockId, settings) => {
    updateBlocks(blocks.map(b => b.id === blockId ? { ...b, settings: { ...b.settings, ...settings } } : b));
  };

  // Drag and drop
  const handleDragStart = (idx) => setDragIndex(idx);
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === idx) return;
    moveBlock(dragIndex, idx);
    setDragIndex(idx);
  };
  const handleDragEnd = () => setDragIndex(null);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!page) {
    return <div className="text-center py-20 text-gray-500">Page not found</div>;
  }

  const selectedBlockData = blocks.find(b => b.id === selectedBlock);

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-140px)] -mx-4 sm:-mx-8 lg:-mx-10 xl:-mx-14 2xl:-mx-16 -mt-10">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/sales-channels/${channelId}`)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[200px]">{page.title}</h1>
              <div className="flex items-center gap-2 text-[10px]">
                <span className={clsx(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-bold',
                  page.status === 'published'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                )}>
                  {page.status === 'published' ? 'Live' : 'Draft'}
                </span>
                {dirty && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">Unsaved changes</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Preview controls */}
            <div className="hidden sm:flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button onClick={() => setPreviewMode('desktop')} className={clsx('p-1.5 rounded-md transition-colors', previewMode === 'desktop' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-400')}>
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setPreviewMode('mobile')} className={clsx('p-1.5 rounded-md transition-colors', previewMode === 'mobile' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-400')}>
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Live preview (StorefrontPreview) */}
            <button
              onClick={() => window.open(`/sales-channels/${channelId}/pages/${pageId}/preview`, '_blank')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium transition-colors"
              title="Preview as customer"
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>

            {/* Fullscreen preview */}
            <button
              onClick={() => setFullscreenPreview(true)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              title="Full page preview"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Open storefront link (if published) */}
            {page.status === 'published' && page.slug && (
              <a
                href={`/s/${page.channelSlug || channelId}/${page.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500"
                title="Open live store"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <div className="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-0.5" />

            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                dirty
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
                (saving || !dirty) && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save'}
            </button>

            {page.status === 'draft' ? (
              hasPermission('saleschannels.publish') && (
                <button onClick={handlePublish} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors">
                  <Rocket className="w-3.5 h-3.5" /> Publish
                </button>
              )
            ) : (
              <button onClick={handleUnpublish} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 rounded-lg transition-colors">
                <Pause className="w-3.5 h-3.5" /> Unpublish
              </button>
            )}
          </div>
        </div>

        {/* Main Content: 3-panel layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel */}
          <div className="w-72 border-e border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col shrink-0 overflow-hidden">
            {/* Panel Tabs */}
            <div className="flex border-b border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setActivePanel('blocks')}
                className={clsx('flex-1 py-2.5 text-xs font-semibold text-center transition-colors border-b-2',
                  activePanel === 'blocks' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                <Layers className="w-3.5 h-3.5 mx-auto mb-0.5" />
                Blocks ({blocks.length})
              </button>
              <button
                onClick={() => setActivePanel('settings')}
                className={clsx('flex-1 py-2.5 text-xs font-semibold text-center transition-colors border-b-2',
                  activePanel === 'settings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                <Settings className="w-3.5 h-3.5 mx-auto mb-0.5" />
                Settings
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {activePanel === 'blocks' && (
                <div className="p-3 space-y-1">
                  {/* Active blocks list */}
                  {blocks.length > 0 ? (
                    <div className="space-y-0.5">
                      {blocks.map((block, idx) => {
                        const meta = BLOCK_TYPES.find(b => b.type === block.type);
                        const Icon = meta?.icon || Layers;
                        const iconColors = ICON_COLOR_MAP[meta?.color] || ICON_COLOR_MAP.gray;
                        return (
                          <div
                            key={block.id}
                            draggable
                            onDragStart={() => handleDragStart(idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDragEnd={handleDragEnd}
                            onClick={() => setSelectedBlock(block.id === selectedBlock ? null : block.id)}
                            className={clsx(
                              'flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all text-xs group',
                              block.id === selectedBlock
                                ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-300 dark:ring-blue-700'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                              !block.isVisible && 'opacity-40',
                              dragIndex === idx && 'opacity-20 scale-95'
                            )}
                          >
                            <GripVertical className="w-3 h-3 text-gray-300 dark:text-gray-600 cursor-grab shrink-0" />
                            <div className={clsx('w-6 h-6 rounded-lg flex items-center justify-center shrink-0', iconColors)}>
                              <Icon className="w-3 h-3" />
                            </div>
                            <span className="flex-1 truncate font-medium text-gray-700 dark:text-gray-300">
                              {meta?.label || block.type}
                            </span>
                            {block.id === selectedBlock && (
                              <ChevronRight className="w-3 h-3 text-blue-500 shrink-0" />
                            )}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={e => { e.stopPropagation(); duplicateBlock(block.id); }}
                                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400"
                                title="Duplicate"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); toggleBlockVisibility(block.id); }}
                                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400"
                                title={block.isVisible ? 'Hide' : 'Show'}
                              >
                                {block.isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); removeBlock(block.id); }}
                                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                      <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-xs font-medium">No blocks yet</p>
                      <p className="text-[10px] mt-0.5">Add blocks below to build your page</p>
                    </div>
                  )}

                  {/* Add block button */}
                  <button
                    onClick={() => setShowAddBlock(!showAddBlock)}
                    className={clsx(
                      'w-full flex items-center justify-center gap-1.5 p-2.5 mt-3 rounded-xl border-2 border-dashed text-xs font-semibold transition-all',
                      showAddBlock
                        ? 'border-blue-400 dark:border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600'
                    )}
                  >
                    {showAddBlock ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {showAddBlock ? 'Close' : 'Add Block'}
                  </button>

                  {/* Categorized block picker */}
                  {showAddBlock && (
                    <div className="mt-2 space-y-3">
                      {BLOCK_CATEGORIES.map(cat => (
                        <div key={cat.id}>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5 px-1">
                            {cat.label}
                          </h4>
                          <div className="grid grid-cols-2 gap-1">
                            {cat.blocks.map(bt => {
                              const iconColors = ICON_COLOR_MAP[bt.color] || ICON_COLOR_MAP.gray;
                              return (
                                <button
                                  key={bt.type}
                                  onClick={() => addBlock(bt.type)}
                                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all text-xs group"
                                >
                                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110', iconColors)}>
                                    <bt.icon className="w-4 h-4" />
                                  </div>
                                  <span className="font-medium text-gray-600 dark:text-gray-400 text-center text-[10px] leading-tight">
                                    {bt.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activePanel === 'settings' && page && (
                <PageSettings page={page} onSave={handleSaveSettings} />
              )}
            </div>
          </div>

          {/* Center: Preview */}
          <div className="flex-1 bg-gray-100 dark:bg-gray-900 overflow-y-auto p-4 flex justify-center">
            <div className={clsx(
              'bg-white dark:bg-gray-800 shadow-xl rounded-xl overflow-hidden transition-all duration-300 self-start',
              previewMode === 'mobile' ? 'w-[375px]' : 'w-full max-w-[900px]'
            )}>
              {/* Preview device frame header */}
              {previewMode === 'mobile' && (
                <div className="bg-gray-900 dark:bg-gray-950 px-4 py-1.5 flex items-center justify-center">
                  <div className="w-16 h-1 rounded-full bg-gray-700" />
                </div>
              )}
              <PagePreview page={page} blocks={blocks} previewMode={previewMode} />
            </div>
          </div>

          {/* Right Panel: Block Editor */}
          {selectedBlockData && (
            <div className="w-80 border-s border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto shrink-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                <div className="flex items-center gap-2">
                  {(() => {
                    const meta = BLOCK_TYPES.find(b => b.type === selectedBlockData.type);
                    const Icon = meta?.icon || Layers;
                    const iconColors = ICON_COLOR_MAP[meta?.color] || ICON_COLOR_MAP.gray;
                    return (
                      <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center', iconColors)}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                    );
                  })()}
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {BLOCK_TYPES.find(b => b.type === selectedBlockData.type)?.label || 'Block Settings'}
                  </h3>
                </div>
                <button onClick={() => setSelectedBlock(null)} className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4">
                <BlockEditor
                  block={selectedBlockData}
                  onUpdate={(settings) => updateBlockSettings(selectedBlockData.id, settings)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {fullscreenPreview && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          {/* Fullscreen top bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold">{page.title}</span>
              <span className="text-xs text-gray-400">Full Preview</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
                <button onClick={() => setPreviewMode('desktop')} className={clsx('p-1.5 rounded-md transition-colors', previewMode === 'desktop' ? 'bg-gray-700 text-white' : 'text-gray-400')}>
                  <Monitor className="w-4 h-4" />
                </button>
                <button onClick={() => setPreviewMode('mobile')} className={clsx('p-1.5 rounded-md transition-colors', previewMode === 'mobile' ? 'bg-gray-700 text-white' : 'text-gray-400')}>
                  <Smartphone className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => setFullscreenPreview(false)}
                className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Fullscreen preview content */}
          <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-950 flex justify-center p-6">
            <div className={clsx(
              'bg-white shadow-2xl overflow-hidden transition-all duration-300 self-start',
              previewMode === 'mobile' ? 'w-[375px] rounded-[2rem]' : 'w-full max-w-[1200px] rounded-xl'
            )}>
              {previewMode === 'mobile' && (
                <div className="bg-gray-900 px-4 py-2 flex items-center justify-center">
                  <div className="w-20 h-1.5 rounded-full bg-gray-700" />
                </div>
              )}
              <PagePreview page={page} blocks={blocks} previewMode={previewMode} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Default settings per block type
function getDefaultSettings(type) {
  const defaults = {
    hero: { headline: 'Get Yours Today!', subheadline: 'Limited time offer', backgroundImage: '', ctaText: 'Order Now' },
    productGallery: { layout: 'slider', showThumbnails: true },
    benefits: { items: [{ icon: 'check', title: 'Free Shipping', description: 'On all orders' }] },
    variantSelector: {},
    codForm: {},
    text: { content: '', alignment: 'center' },
    image: { url: '', alt: '', fullWidth: true },
    video: { url: '', autoplay: false },
    testimonials: { items: [{ name: '', text: '', rating: 5, avatar: '' }] },
    reviews: { items: [] },
    faq: { items: [{ question: 'How long is delivery?', answer: '2-5 business days' }] },
    cta: { text: 'Order Now', style: 'primary', scrollTo: 'codForm' },
    guarantee: { title: 'Money Back Guarantee', description: '30-day return policy', icon: 'shield' },
    countdown: { endDate: '', label: 'Offer ends in' },
    trustBadges: { badges: ['secure', 'cod', 'fast-delivery', 'guarantee'] },
    deliveryInfo: { title: 'Delivery Information', wilayas: 'All 58 wilayas', timeframe: '2-5 days' },
    stockScarcity: { message: 'Only {count} left in stock!', count: 12, showBar: true },
    spacer: { height: 40 }
  };
  return defaults[type] || {};
}
