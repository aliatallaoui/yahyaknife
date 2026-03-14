import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Search, Package, Sparkles, Upload, ImagePlus, ChevronLeft, ChevronRight,
  Wand2, CheckCircle2, Loader2, AlertCircle, Palette, Languages, Eye, Image as ImageIcon,
  LayoutGrid, Star, MessageSquare, HelpCircle, Shield, Truck, Clock, BarChart3, Type,
  ShoppingCart, Award, Zap, ToggleLeft, ToggleRight
} from 'lucide-react';
import useModalDismiss from '../../hooks/useModalDismiss';
import { apiFetch } from '../../utils/apiFetch';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || '';
const STEPS = ['product', 'images', 'theme', 'sections', 'generate'];

// Human-readable metadata for each block type
const BLOCK_META = {
  hero:            { label: 'Hero Banner',       labelAr: 'بانر رئيسي',      icon: LayoutGrid,   description: 'Eye-catching hero section with headline & CTA', required: false },
  productGallery:  { label: 'Product Gallery',   labelAr: 'معرض المنتج',     icon: ImageIcon,    description: 'Product image gallery with thumbnails', required: false },
  benefits:        { label: 'Benefits',          labelAr: 'المزايا',          icon: Star,         description: 'Key product benefits & features', required: false },
  testimonials:    { label: 'Testimonials',      labelAr: 'آراء العملاء',     icon: MessageSquare, description: 'Customer reviews & social proof', required: false },
  faq:             { label: 'FAQ',               labelAr: 'أسئلة شائعة',     icon: HelpCircle,   description: 'Frequently asked questions', required: false },
  guarantee:       { label: 'Guarantee',         labelAr: 'ضمان',            icon: Shield,       description: 'Satisfaction guarantee badge', required: false },
  deliveryInfo:    { label: 'Delivery Info',     labelAr: 'معلومات التوصيل', icon: Truck,        description: 'Shipping & delivery details', required: false },
  trustBadges:     { label: 'Trust Badges',      labelAr: 'شارات الثقة',     icon: Award,        description: 'Security & trust indicators', required: false },
  countdown:       { label: 'Countdown Timer',   labelAr: 'عد تنازلي',       icon: Clock,        description: 'Urgency countdown timer', required: false },
  stockScarcity:   { label: 'Stock Scarcity',    labelAr: 'كمية محدودة',     icon: BarChart3,    description: 'Limited stock urgency indicator', required: false },
  cta:             { label: 'Call to Action',    labelAr: 'زر الطلب',        icon: Zap,          description: 'Secondary CTA button', required: false },
  text:            { label: 'Text Block',        labelAr: 'نص وصفي',         icon: Type,         description: 'Rich text / product story', required: false },
  variantSelector: { label: 'Variant Selector',  labelAr: 'اختيار المتغير',  icon: ShoppingCart,  description: 'Color/size variant picker', required: true },
  codForm:         { label: 'Order Form',        labelAr: 'نموذج الطلب',     icon: ShoppingCart,  description: 'Cash-on-delivery order form', required: true },
};

const LANGUAGES = [
  { value: 'ar', label: 'العربية', flag: '🇩🇿' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'en', label: 'English', flag: '🇬🇧' }
];

export default function AIGeneratorWizard({ channelId, onComplete, onClose }) {
  const { t } = useTranslation();
  const { backdropProps, panelProps } = useModalDismiss(onClose);
  const [step, setStep] = useState(0);

  // Step 1: Product
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productsLoading, setProductsLoading] = useState(true);

  // Step 2: Images
  const [uploadedImages, setUploadedImages] = useState([]);
  const [useProductImages, setUseProductImages] = useState(true);

  // Step 3: Theme + Language + AI Images
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState('modern_ecommerce');
  const [language, setLanguage] = useState('ar');
  const [generateAIImages, setGenerateAIImages] = useState(true);
  const [themesLoading, setThemesLoading] = useState(true);

  // Step 4: Section chooser
  const [enabledBlocks, setEnabledBlocks] = useState({});

  // Step 5: Generate
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Load products
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/inventory/products');
        if (res.ok) {
          const json = await res.json();
          setProducts(json.data ?? json);
        }
      } catch { /* ignore */ }
      setProductsLoading(false);
    })();
  }, []);

  // Load themes
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/sales-channels/ai/themes');
        if (res.ok) {
          const json = await res.json();
          setThemes(json.data ?? json);
        }
      } catch { /* ignore */ }
      setThemesLoading(false);
    })();
  }, []);

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const compressImage = (file, maxSize = 1024, quality = 0.7) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (uploadedImages.length + files.length > 4) {
      toast.error(t('salesChannels.ai.maxImages', 'Maximum 4 images allowed'));
      return;
    }
    for (const file of files) {
      const compressed = await compressImage(file);
      setUploadedImages(prev => [...prev, compressed]);
    }
  };

  const removeImage = (idx) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== idx));
  };

  // Initialize enabledBlocks when theme changes
  const currentTheme = themes.find(t => t.key === selectedTheme);
  useEffect(() => {
    if (currentTheme?.blockOrder) {
      const initial = {};
      for (const b of currentTheme.blockOrder) {
        initial[b] = true; // all enabled by default
      }
      setEnabledBlocks(initial);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTheme, currentTheme?.blockOrder?.join(',')]);

  const toggleBlock = (blockType) => {
    const meta = BLOCK_META[blockType];
    if (meta?.required) return; // can't disable required blocks
    setEnabledBlocks(prev => ({ ...prev, [blockType]: !prev[blockType] }));
  };

  const enabledBlockList = Object.entries(enabledBlocks).filter(([, v]) => v).map(([k]) => k);

  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedProduct;
      case 1: {
        const hasProductImages = selectedProduct?.images?.length > 0;
        if (useProductImages && hasProductImages) return true;
        return uploadedImages.length > 0;
      }
      case 2: return !!selectedTheme;
      case 3: return enabledBlockList.length >= 2; // at least codForm + 1 other
      default: return true;
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const body = {
        productId: selectedProduct._id,
        theme: selectedTheme,
        language,
        generateImages: generateAIImages,
        enabledBlocks: enabledBlockList
      };
      if (uploadedImages.length > 0 && (!useProductImages || !selectedProduct?.images?.length)) {
        body.images = uploadedImages;
      }

      const res = await apiFetch(`/api/sales-channels/${channelId}/pages/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const json = await res.json();
        const page = json.data ?? json;
        toast.success(t('salesChannels.ai.success', 'AI page generated successfully!'));
        onComplete(page);
      } else {
        const err = await res.json();
        setError(err.message || 'Failed to generate page. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Connection failed. Please check your network and try again.');
    } finally {
      setGenerating(false);
    }
  };

  const stepLabels = [
    t('salesChannels.ai.stepProduct', 'Product'),
    t('salesChannels.ai.stepImages', 'Images'),
    t('salesChannels.ai.stepTheme', 'Theme'),
    t('salesChannels.ai.stepSections', 'Sections'),
    t('salesChannels.ai.stepGenerate', 'Generate')
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" {...backdropProps}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" {...panelProps}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {t('salesChannels.ai.title', 'AI Page Generator')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('salesChannels.ai.subtitle', 'Generate a high-conversion landing page with AI')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-gray-50 dark:border-gray-700/50">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className="flex items-center gap-1.5 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < step ? 'bg-emerald-500 text-white' :
                  i === step ? 'bg-blue-600 text-white' :
                  'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                }`}>
                  {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${
                  i === step ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                }`}>{stepLabels[i]}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 rounded ${i < step ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-600'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Product Selection */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('salesChannels.ai.selectProduct', 'Select a product for your landing page')}
                </label>
                <div className="relative mb-3">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder={t('salesChannels.searchProducts', 'Search products...')}
                    className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1.5 border border-gray-100 dark:border-gray-600 rounded-xl p-2">
                  {productsLoading ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                      {t('common.loading', 'Loading...')}
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">{t('salesChannels.noProducts', 'No products found')}</div>
                  ) : filteredProducts.map(p => (
                    <button
                      key={p._id}
                      onClick={() => { setSelectedProduct(p); setUseProductImages(p.images?.length > 0); }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-start transition-all ${
                        selectedProduct?._id === p._id
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-400 dark:border-blue-600 shadow-sm'
                          : 'border-2 border-transparent hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-600 overflow-hidden shrink-0">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package className="w-5 h-5 text-gray-400" /></div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{p.category?.name || t('inventory.uncategorized', 'Uncategorized')}</p>
                        {p.images?.length > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{t('salesChannels.ai.imageCount', '{{count}} image(s)', { count: p.images.length })}</p>
                        )}
                      </div>
                      {selectedProduct?._id === p._id && (
                        <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Images */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('salesChannels.ai.imageDesc', 'AI will analyze the images to generate optimized content for your landing page.')}
              </p>

              {/* Option: Use product images (only if product has images) */}
              {selectedProduct?.images?.length > 0 && (
                <label className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors"
                  style={{ borderColor: useProductImages ? '#3b82f6' : 'transparent', backgroundColor: useProductImages ? 'rgba(59,130,246,0.05)' : 'transparent' }}>
                  <input type="radio" checked={useProductImages} onChange={() => setUseProductImages(true)} className="text-blue-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {t('salesChannels.ai.useProductImages', 'Use product images')}
                    </p>
                    <p className="text-xs text-gray-500">{t('salesChannels.ai.imagesAvailable', '{{count}} image(s) available', { count: selectedProduct.images.length })}</p>
                  </div>
                </label>
              )}

              {/* Show product image thumbnails when selected */}
              {useProductImages && selectedProduct?.images?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {selectedProduct.images.slice(0, 4).map((img, i) => (
                    <div key={i} className="w-20 h-20 rounded-lg overflow-hidden border-2 border-blue-200 dark:border-blue-700">
                      <img src={img.startsWith('data:') || img.startsWith('http') ? img : `${API_BASE}${img}`} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              {/* Option: Upload custom images (always shown) */}
              {selectedProduct?.images?.length > 0 ? (
                <label className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors"
                  style={{ borderColor: !useProductImages ? '#3b82f6' : 'transparent', backgroundColor: !useProductImages ? 'rgba(59,130,246,0.05)' : 'transparent' }}>
                  <input type="radio" checked={!useProductImages} onChange={() => setUseProductImages(false)} className="text-blue-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {t('salesChannels.ai.uploadCustom', 'Upload custom images')}
                    </p>
                    <p className="text-xs text-gray-500">{t('salesChannels.ai.maxFour', 'Up to 4 images')}</p>
                  </div>
                </label>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    {t('salesChannels.ai.noProductImages', 'This product has no images. Upload at least one image for AI analysis.')}
                  </p>
                </div>
              )}

              {/* Upload area (shown when no product images OR user chose custom) */}
              {(!selectedProduct?.images?.length || !useProductImages) && (
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                    <ImagePlus className="w-8 h-8 text-gray-400" />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('salesChannels.ai.dropImages', 'Click to upload images')}
                    </span>
                    <span className="text-xs text-gray-400">{t('salesChannels.ai.imageFormats', 'PNG, JPG — max 4 images')}</span>
                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                  </label>

                  {uploadedImages.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {uploadedImages.map((img, i) => (
                        <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600">
                          <img src={img} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => removeImage(i)}
                            className="absolute top-0.5 end-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Theme + Language */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Theme selection */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  <Palette className="w-4 h-4" />
                  {t('salesChannels.ai.selectTheme', 'Select Theme')}
                </label>
                {themesLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {themes.map(theme => (
                      <button
                        key={theme.key}
                        onClick={() => setSelectedTheme(theme.key)}
                        className={`text-start p-3 rounded-xl border-2 transition-all ${
                          selectedTheme === theme.key
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">{theme.label}</h4>
                          {/* Color swatches */}
                          <div className="flex gap-1">
                            <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: theme.theme?.primaryColor || '#2563eb' }} />
                            <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: theme.theme?.accentColor || '#f59e0b' }} />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{theme.description}</p>
                        <p className="text-[10px] text-gray-400 mt-1.5">{t('salesChannels.ai.blockCount', '{{count}} blocks', { count: theme.blockCount })}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Language selection */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  <Languages className="w-4 h-4" />
                  {t('salesChannels.ai.selectLanguage', 'Content Language')}
                </label>
                <div className="flex gap-2">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.value}
                      onClick={() => setLanguage(lang.value)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                        language === lang.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      <span>{lang.flag}</span> {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Image Generation (Nano Banana) */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  <ImageIcon className="w-4 h-4" />
                  {t('salesChannels.ai.aiImages', 'AI Image Generation')}
                </label>
                <button
                  onClick={() => setGenerateAIImages(!generateAIImages)}
                  className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-start transition-all ${
                    generateAIImages
                      ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 shadow-sm'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    generateAIImages
                      ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                      : 'bg-gray-200 dark:bg-gray-600'
                  }`}>
                    <Sparkles className={`w-5 h-5 ${generateAIImages ? 'text-white' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        {t('salesChannels.ai.nanoBanana', 'Generate AI Images (Nano Banana)')}
                      </h4>
                      <div className={`w-10 h-6 rounded-full flex items-center transition-colors ${
                        generateAIImages ? 'bg-purple-500 justify-end' : 'bg-gray-300 dark:bg-gray-600 justify-start'
                      }`}>
                        <div className="w-5 h-5 bg-white rounded-full shadow mx-0.5" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t('salesChannels.ai.nanoBananaDesc', 'AI generates professional hero banners and marketing images based on your product. Creates high-quality visuals optimized for each section.')}
                    </p>
                    {generateAIImages && (
                      <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1.5 font-medium">
                        {t('salesChannels.ai.nanoBananaTime', 'Adds ~20-30 seconds to generation time')}
                      </p>
                    )}
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Section Chooser */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <LayoutGrid className="w-4 h-4" />
                    {t('salesChannels.ai.chooseSections', 'Choose Page Sections')}
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('salesChannels.ai.chooseSectionsDesc', 'Toggle sections on/off to customize your landing page layout.')}
                  </p>
                </div>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg">
                  {enabledBlockList.length} / {currentTheme?.blockOrder?.length || 0}
                </span>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {(currentTheme?.blockOrder || []).map((blockType, idx) => {
                  const meta = BLOCK_META[blockType] || { label: blockType, icon: LayoutGrid, description: '', required: false };
                  const Icon = meta.icon;
                  const isEnabled = enabledBlocks[blockType] !== false;
                  const isRequired = meta.required;

                  return (
                    <button
                      key={`${blockType}-${idx}`}
                      onClick={() => toggleBlock(blockType)}
                      disabled={isRequired}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-start transition-all ${
                        isEnabled
                          ? isRequired
                            ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/20'
                            : 'border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 opacity-60'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isEnabled
                          ? isRequired
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {language === 'ar' ? (meta.labelAr || meta.label) : meta.label}
                          </span>
                          {isRequired && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded">
                              {t('common.required', 'Required')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{meta.description}</p>
                      </div>
                      <div className="shrink-0">
                        {isEnabled ? (
                          <ToggleRight className={`w-6 h-6 ${isRequired ? 'text-emerald-500' : 'text-blue-500'}`} />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 5: Generate / Summary */}
          {step === 4 && (
            <div className="space-y-5">
              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {t('salesChannels.ai.summary', 'Generation Summary')}
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{selectedProduct?.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <ImagePlus className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {useProductImages
                        ? t('salesChannels.ai.productImages', '{{count}} product images', { count: Math.min(selectedProduct?.images?.length || 0, 4) })
                        : t('salesChannels.ai.uploadedImages', '{{count}} uploaded images', { count: uploadedImages.length })
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Palette className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {themes.find(t => t.key === selectedTheme)?.label || selectedTheme}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Languages className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {LANGUAGES.find(l => l.value === language)?.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {enabledBlockList.length} {t('salesChannels.ai.sectionsEnabled', 'sections enabled')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <ImageIcon className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {generateAIImages
                        ? t('salesChannels.ai.aiImagesOn', 'AI Images: Enabled (Nano Banana)')
                        : t('salesChannels.ai.aiImagesOff', 'AI Images: Disabled')
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Generate button */}
              {!generating && !error && (
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <Wand2 className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('salesChannels.ai.readyDesc', 'AI will analyze your product images and generate a complete, high-conversion landing page.')}
                  </p>
                  <button
                    onClick={handleGenerate}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-200 dark:shadow-purple-900/30 transition-all"
                  >
                    <Sparkles className="w-4 h-4" /> {t('salesChannels.ai.generate', 'Generate Landing Page')}
                  </button>
                </div>
              )}

              {/* Generating state */}
              {generating && (
                <div className="text-center space-y-4 py-6">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center animate-pulse">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {t('salesChannels.ai.generating', 'AI is generating your page...')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {generateAIImages
                        ? t('salesChannels.ai.generatingDescImages', 'Analyzing images, crafting copy, generating marketing visuals, and building blocks. This may take 30-60 seconds.')
                        : t('salesChannels.ai.generatingDesc', 'Analyzing images, crafting copy, and building blocks. This may take 15-30 seconds.')
                      }
                    </p>
                  </div>
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500 mx-auto" />
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">{t('salesChannels.ai.error', 'Generation Failed')}</p>
                    <p className="text-xs text-red-600 dark:text-red-300 mt-1">{error}</p>
                    <button
                      onClick={() => { setError(''); handleGenerate(); }}
                      className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                    >
                      {t('common.retry', 'Try Again')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => step === 0 ? onClose() : setStep(step - 1)}
            disabled={generating}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl disabled:opacity-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? t('common.cancel', 'Cancel') : t('common.back', 'Back')}
          </button>

          {step < 4 && (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-1 px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors"
            >
              {t('common.next', 'Next')} <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
