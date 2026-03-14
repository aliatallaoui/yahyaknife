import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Star, Shield, Truck, Clock, Check, Package, ShoppingCart,
  ChevronDown, AlertTriangle, Play, Minus, Plus, X, Loader2,
  Phone, MapPin, User, MessageSquare, HelpCircle, CheckCircle,
  ChevronLeft, ChevronRight, Quote
} from 'lucide-react';
import clsx from 'clsx';

const API_BASE = import.meta.env.VITE_API_URL || '';

/** Sanitize URLs to prevent javascript:/data: XSS in img src, iframe src, and CSS url() */
function safeMediaUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  // Allow http(s), relative paths, blob URLs, and base64 image data-URIs
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('blob:')) return trimmed;
  if (/^data:image\/(jpeg|jpg|png|webp|gif|svg\+xml);base64,/i.test(trimmed)) return trimmed;
  return '';
}

/**
 * Public-facing storefront landing page.
 * No auth. Renders the published landing page and COD order form.
 */
export default function Storefront({ previewData: externalPreviewData } = {}) {
  const { channelSlug, pageSlug } = useParams();
  const [searchParams] = useSearchParams();

  const isPreview = !!externalPreviewData;
  const [pageData, setPageData] = useState(externalPreviewData || null);
  const [loading, setLoading] = useState(!externalPreviewData);
  const [error, setError] = useState(null);

  // Form state
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [formData, setFormData] = useState({
    customerName: '', phone: '', phone2: '',
    wilayaCode: '', wilayaName: '', commune: '', address: '',
    deliveryType: 0, notes: ''
  });
  const [communes, setCommunes] = useState([]);
  const [deliveryPrice, setDeliveryPrice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [openFaq, setOpenFaq] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const formRef = useRef(null);
  const sessionId = useRef(Math.random().toString(36).substring(2) + Date.now().toString(36));

  // UTM from URL params
  const utm = {
    source: searchParams.get('utm_source'),
    medium: searchParams.get('utm_medium'),
    campaign: searchParams.get('utm_campaign'),
    term: searchParams.get('utm_term'),
    content: searchParams.get('utm_content')
  };

  // Fetch page data (skip if previewData was passed in)
  useEffect(() => {
    if (isPreview) {
      // Set default variant from preview data
      if (externalPreviewData?.variants?.length) {
        const defaultId = externalPreviewData.page?.productOverrides?.defaultVariant;
        setSelectedVariant(
          externalPreviewData.variants.find(v => v._id === defaultId) || externalPreviewData.variants[0]
        );
      }
      return;
    }
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/s/${channelSlug}/${pageSlug}`, { signal: ac.signal });
        if (!res.ok) throw new Error('Page not found');
        const json = await res.json();
        const data = json.data ?? json;
        setPageData(data);

        // Default variant selection
        if (data.variants?.length) {
          const defaultId = data.page?.productOverrides?.defaultVariant;
          setSelectedVariant(
            data.variants.find(v => v._id === defaultId) || data.variants[0]
          );
        }

        // Track page view
        trackEvent('page_view');
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [channelSlug, pageSlug, isPreview]);

  // Resolve storefront slug for coverage/price endpoints (works for both public and preview)
  const storeSlug = channelSlug || pageData?.channel?.slug;
  const storePageSlug = pageSlug || pageData?.page?.slug;

  const trackEvent = useCallback((event, data = {}) => {
    if (isPreview || !storeSlug || !storePageSlug) return; // Don't track events in preview mode
    fetch(`${API_BASE}/s/${storeSlug}/${storePageSlug}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        sessionId: sessionId.current,
        visitorId: getVisitorId(),
        utm,
        device: { type: /Mobi/i.test(navigator.userAgent) ? 'mobile' : 'desktop' },
        referrer: document.referrer,
        data
      })
    }).catch(() => {});
  }, [storeSlug, storePageSlug, isPreview]);

  // SEO meta tags + document title
  useEffect(() => {
    if (!pageData) return;
    const { page, product, pixels: px } = pageData;
    const seo = page.seo || {};

    // Document title
    document.title = seo.title || page.title || product?.name || 'Store';

    // Helper to set/create a meta tag
    const setMeta = (attr, key, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };

    setMeta('name', 'description', seo.description);
    setMeta('property', 'og:title', seo.title || page.title);
    setMeta('property', 'og:description', seo.description);
    setMeta('property', 'og:type', 'product');
    if (seo.ogImage || product?.images?.[0]) {
      const imgUrl = seo.ogImage || product.images[0];
      setMeta('property', 'og:image', imgUrl.startsWith('/') ? `${window.location.origin}${imgUrl}` : imgUrl);
    }
    setMeta('property', 'og:url', window.location.href);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', seo.title || page.title);
    setMeta('name', 'twitter:description', seo.description);

    // GTM container (if configured)
    const gtmId = px?.googleTagManagerId;
    if (gtmId && /^GTM-[A-Z0-9]+$/i.test(gtmId) && !document.getElementById('gtm-script')) {
      const s = document.createElement('script');
      s.id = 'gtm-script';
      s.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`;
      document.head.appendChild(s);
    }

    return () => { document.title = 'Store'; };
  }, [pageData]);

  // Fire ViewContent pixel once after pixels are loaded
  const viewContentFired = useRef(false);
  useEffect(() => {
    if (!pageData || isPreview || viewContentFired.current) return;
    // Small delay to ensure pixel scripts have loaded
    const timer = setTimeout(() => {
      firePixelEvent('ViewContent', { content_name: pageData.product?.name, content_type: 'product', currency: 'DZD' });
      viewContentFired.current = true;
    }, 500);
    return () => clearTimeout(timer);
  }, [pageData, isPreview]);

  // Fetch communes when wilaya changes
  useEffect(() => {
    if (!formData.wilayaCode || !pageData || !storeSlug || !storePageSlug) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/s/${storeSlug}/${storePageSlug}/coverage?wilayaCode=${formData.wilayaCode}`);
        if (res.ok) {
          const json = await res.json();
          setCommunes(json.data ?? json);
        }
      } catch { /* ignore */ }
    })();
  }, [formData.wilayaCode, storeSlug, storePageSlug, pageData]);

  // Calculate delivery price when commune changes
  useEffect(() => {
    if (!formData.commune || !formData.wilayaCode || !pageData || !storeSlug || !storePageSlug) return;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/s/${storeSlug}/${storePageSlug}/price?wilayaCode=${formData.wilayaCode}&commune=${encodeURIComponent(formData.commune)}&deliveryType=${formData.deliveryType}`
        );
        if (res.ok) {
          const json = await res.json();
          const data = json.data ?? json;
          setDeliveryPrice(data.price);
        }
      } catch { setDeliveryPrice(null); }
    })();
  }, [formData.commune, formData.wilayaCode, formData.deliveryType, storeSlug, storePageSlug, pageData]);

  const updateForm = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.customerName.trim()) errors.customerName = 'Required';
    if (!formData.phone.trim()) errors.phone = 'Required';
    else if (!/^(0[567]\d{8})$/.test(formData.phone.replace(/\s/g, ''))) errors.phone = 'Invalid phone format';
    if (!formData.wilayaCode) errors.wilayaCode = 'Required';
    if (!formData.commune) errors.commune = 'Required';
    if (Object.keys(errors).length) { setFormErrors(errors); return; }

    trackEvent('form_submit', { variantId: selectedVariant?._id, quantity });
    firePixelEvent('InitiateCheckout', { value: totalPrice, currency: 'DZD', content_name: product?.name });
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/s/${storeSlug}/${storePageSlug}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: formData.customerName.trim(),
          phone: formData.phone.replace(/\s/g, ''),
          phone2: formData.phone2 || undefined,
          wilayaCode: formData.wilayaCode,
          wilayaName: formData.wilayaName,
          commune: formData.commune,
          address: formData.address,
          deliveryType: formData.deliveryType,
          variantId: selectedVariant?._id,
          quantity,
          notes: formData.notes,
          utm
        })
      });

      if (res.ok) {
        const json = await res.json();
        const result = json.data ?? json;
        setOrderSuccess(result);
        trackEvent('order_created', { orderId: result.orderId });
        firePixelEvent('Purchase', { value: totalPrice, currency: 'DZD' });
      } else {
        const err = await res.json();
        setFormErrors({ submit: err.message || 'Order failed. Please try again.' });
      }
    } catch {
      setFormErrors({ submit: 'Network error. Please try again.' });
    }
    setSubmitting(false);
  };

  // Calculate prices
  const unitPrice = pageData?.page?.productOverrides?.promotionalPrice || selectedVariant?.price || 0;
  const subtotal = unitPrice * quantity;
  const totalPrice = subtotal + (deliveryPrice || 0);
  const originalPrice = selectedVariant?.price || 0;
  const hasDiscount = pageData?.page?.productOverrides?.promotionalPrice && pageData.page.productOverrides.promotionalPrice < originalPrice;

  // Loading / Error states
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !pageData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-700 dark:text-gray-300">Page Not Found</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{error || 'This page is no longer available'}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (orderSuccess) {
    const isArtisan = pageData.page?.theme?.layout === 'artisan';
    return (
      <div className={clsx(
        'min-h-screen flex items-center justify-center p-4',
        isArtisan ? 'storefront-artisan-bg' : 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-900 dark:to-gray-800'
      )}>
        <div className={clsx(
          'rounded-3xl shadow-xl p-8 max-w-md w-full text-center',
          isArtisan ? 'bg-[#2a1f0e] border-2 border-[#c9a84c]/30' : 'bg-white dark:bg-gray-800'
        )}>
          <div className={clsx(
            'w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5',
            isArtisan ? 'bg-[#c9a84c]/20' : 'bg-green-100 dark:bg-green-900/30'
          )}>
            <CheckCircle className={clsx('w-10 h-10', isArtisan ? 'text-[#c9a84c]' : 'text-green-600')} />
          </div>
          <h2 className={clsx('text-2xl font-bold mb-2', isArtisan ? 'text-[#e8dcc8]' : 'text-gray-900 dark:text-white')}>
            {pageData.page?.formConfig?.successMessage || 'Order Placed Successfully!'}
          </h2>
          <p className={clsx('mb-4', isArtisan ? 'text-[#c9a84c]' : 'text-gray-500 dark:text-gray-400')}>
            Order ID: <span className={clsx('font-mono font-bold', isArtisan ? 'text-[#d4af37]' : 'text-gray-800 dark:text-gray-200')}>{orderSuccess.orderId}</span>
          </p>
          <p className={clsx('text-sm', isArtisan ? 'text-[#a89070]' : 'text-gray-500 dark:text-gray-400')}>We will contact you shortly to confirm your order.</p>
        </div>
      </div>
    );
  }

  const { page, product, variants, pixels, channel } = pageData;
  const theme = page.theme || {};
  const primaryColor = theme.primaryColor || '#2563eb';
  const accentColor = theme.accentColor || '#f59e0b';
  const isArtisan = theme.layout === 'artisan';
  const images = product.images || [];

  // Inject pixels
  injectPixels(pixels);

  return (
    <>
      {isArtisan && <ArtisanStyles primaryColor={primaryColor} accentColor={accentColor} />}
      <div
        className={clsx('min-h-screen', isArtisan && 'storefront-artisan-bg')}
        style={{
          fontFamily: isArtisan
            ? "'Amiri', 'Noto Naskh Arabic', 'Georgia', serif"
            : (channel?.branding?.fontFamily || 'Inter, sans-serif'),
          ...(isArtisan ? {} : { backgroundColor: '#ffffff' })
        }}
      >
        {/* Artisan: Top nav bar */}
        {isArtisan && (
          <nav className="sticky top-0 z-50 artisan-nav-bg border-b border-[#c9a84c]/20">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {channel?.branding?.logo ? (
                  <img src={channel.branding.logo} alt="" className="h-10" />
                ) : (
                  <div className="w-10 h-10 rounded-full border-2 border-[#c9a84c] flex items-center justify-center">
                    <span className="text-[#c9a84c] font-bold text-lg">{(channel?.name || 'S')[0]}</span>
                  </div>
                )}
                <span className="text-[#c9a84c] font-bold text-lg hidden sm:block">{channel?.name}</span>
              </div>
              <button
                onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="px-5 py-2 border-2 border-[#c9a84c] text-[#c9a84c] rounded-lg text-sm font-bold hover:bg-[#c9a84c]/10 transition-colors"
              >
                {page.formConfig?.submitButtonText || 'Order Now'}
              </button>
            </div>
          </nav>
        )}

        {/* Render blocks in order */}
        {page.blocks.map(block => (
          <StorefrontBlock
            key={block.id}
            block={block}
            theme={{ primaryColor, accentColor }}
            isArtisan={isArtisan}
            product={product}
            images={images}
            variants={variants}
            selectedVariant={selectedVariant}
            setSelectedVariant={setSelectedVariant}
            quantity={quantity}
            setQuantity={setQuantity}
            formData={formData}
            updateForm={updateForm}
            formErrors={formErrors}
            communes={communes}
            deliveryPrice={deliveryPrice}
            unitPrice={unitPrice}
            subtotal={subtotal}
            totalPrice={totalPrice}
            originalPrice={originalPrice}
            hasDiscount={hasDiscount}
            submitting={submitting}
            handleSubmit={handleSubmit}
            formRef={formRef}
            variantDisplay={page.variantDisplay}
            formConfig={page.formConfig}
            openFaq={openFaq}
            setOpenFaq={setOpenFaq}
            galleryIndex={galleryIndex}
            setGalleryIndex={setGalleryIndex}
            trackEvent={trackEvent}
          />
        ))}

        {/* Artisan: Footer */}
        {isArtisan && (
          <footer className="artisan-nav-bg border-t border-[#c9a84c]/20 py-8 px-4 text-center">
            <p className="text-[#a89070] text-sm">&copy; {new Date().getFullYear()} {channel?.name}</p>
          </footer>
        )}
      </div>
    </>
  );
}

// ── Artisan Styles (injected as <style> for the artisan layout) ──────────────

function ArtisanStyles({ primaryColor, accentColor }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet" />
      <style>{`
        .storefront-artisan-bg {
          background-color: #1a1208;
          background-image:
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 2px,
              rgba(201,168,76,0.03) 2px,
              rgba(201,168,76,0.03) 4px
            ),
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 50px,
              rgba(201,168,76,0.02) 50px,
              rgba(201,168,76,0.02) 51px
            ),
            linear-gradient(180deg, #1a1208 0%, #241a0d 50%, #1a1208 100%);
        }
        .artisan-nav-bg {
          background: rgba(26,18,8,0.95);
          backdrop-filter: blur(12px);
        }
        .artisan-frame {
          position: relative;
          border: 3px solid ${primaryColor};
          padding: 4px;
          background: #2a1f0e;
        }
        .artisan-frame::before {
          content: '';
          position: absolute;
          inset: 6px;
          border: 1px solid ${primaryColor}66;
          pointer-events: none;
        }
        .artisan-circle-frame {
          border: 3px solid ${primaryColor};
          border-radius: 50%;
          padding: 4px;
          background: #2a1f0e;
        }
        .artisan-circle-frame img {
          border-radius: 50%;
        }
        .artisan-gold-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, ${primaryColor}, transparent);
          margin: 2rem auto;
          max-width: 300px;
        }
        .artisan-btn {
          border: 2px solid ${primaryColor};
          color: ${primaryColor};
          background: transparent;
          padding: 12px 32px;
          font-weight: 700;
          letter-spacing: 0.5px;
          transition: all 0.3s;
        }
        .artisan-btn:hover {
          background: ${primaryColor};
          color: #1a1208;
        }
        .artisan-btn-filled {
          border: 2px solid ${primaryColor};
          color: #1a1208;
          background: ${primaryColor};
          padding: 14px 32px;
          font-weight: 700;
          letter-spacing: 0.5px;
          transition: all 0.3s;
        }
        .artisan-btn-filled:hover {
          background: ${accentColor};
          border-color: ${accentColor};
        }
        .artisan-input {
          background: #2a1f0e;
          border: 1px solid ${primaryColor}40;
          color: #e8dcc8;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 14px;
          width: 100%;
        }
        .artisan-input:focus {
          outline: none;
          border-color: ${primaryColor};
          box-shadow: 0 0 0 2px ${primaryColor}20;
        }
        .artisan-input::placeholder {
          color: #a8907066;
        }
        .artisan-select {
          background: #2a1f0e;
          border: 1px solid ${primaryColor}40;
          color: #e8dcc8;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 14px;
          width: 100%;
        }
        .artisan-select:focus {
          outline: none;
          border-color: ${primaryColor};
        }
        .artisan-select option {
          background: #2a1f0e;
          color: #e8dcc8;
        }
      `}</style>
    </>
  );
}

// ── StorefrontBlock renderer ──────────────────────────────────────────────────

function StorefrontBlock({
  block, theme, isArtisan, product, images, variants, selectedVariant, setSelectedVariant,
  quantity, setQuantity, formData, updateForm, formErrors, communes,
  deliveryPrice, unitPrice, subtotal, totalPrice, originalPrice, hasDiscount,
  submitting, handleSubmit, formRef, variantDisplay, formConfig,
  openFaq, setOpenFaq, galleryIndex, setGalleryIndex, trackEvent
}) {
  const type = block.type;
  const s = block.settings || {};
  const { primaryColor, accentColor } = theme;

  if (block.isVisible === false) return null;

  switch (type) {
    // ── HERO ──────────────────────────────────────────────────────────────
    case 'hero':
      if (isArtisan) {
        return (
          <div
            className="relative px-6 py-24 md:py-32 text-center"
            style={{
              background: s.backgroundImage
                ? `linear-gradient(rgba(26,18,8,0.6), rgba(26,18,8,0.75)), url(${safeMediaUrl(s.backgroundImage)}) center/cover`
                : `linear-gradient(135deg, #1a1208, #2a1f0e)`
            }}
          >
            <div className="max-w-3xl mx-auto">
              <p className="text-sm uppercase tracking-[0.3em] mb-4" style={{ color: primaryColor }}>{product.name}</p>
              <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-5" style={{ color: '#e8dcc8' }}>
                {s.headline || product.name}
              </h1>
              {s.subheadline && (
                <p className="text-lg md:text-xl mb-8" style={{ color: '#a89070' }}>{s.subheadline}</p>
              )}
              <button
                onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="artisan-btn rounded-lg text-lg"
              >
                {s.ctaText || 'Order Now'}
              </button>
            </div>
          </div>
        );
      }
      return (
        <div
          className="relative px-6 py-20 text-center"
          style={{
            background: s.backgroundImage
              ? `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${safeMediaUrl(s.backgroundImage)}) center/cover`
              : `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`
          }}
        >
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4 leading-tight max-w-2xl mx-auto">
            {s.headline || product.name}
          </h1>
          {s.subheadline && <p className="text-lg md:text-xl text-white/80 mb-8 max-w-lg mx-auto">{s.subheadline}</p>}
          <button
            onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="px-10 py-4 rounded-xl text-white font-bold text-lg shadow-2xl hover:scale-105 active:scale-95 transition-transform"
            style={{ backgroundColor: accentColor }}
          >
            {s.ctaText || 'Order Now'}
          </button>
        </div>
      );

    // ── PRODUCT GALLERY ──────────────────────────────────────────────────
    case 'productGallery':
      if (isArtisan) {
        return (
          <div className="px-4 md:px-8 py-10 max-w-4xl mx-auto">
            {images.length > 0 ? (
              <>
                <div className="artisan-frame rounded-lg overflow-hidden mb-4">
                  <img src={images[galleryIndex] || images[0]} alt={product.name} className="w-full aspect-square object-contain bg-[#1a1208]" />
                </div>
                {images.length > 1 && (
                  <div className="flex gap-3 justify-center overflow-x-auto pb-2">
                    {images.map((img, i) => (
                      <button key={i} onClick={() => setGalleryIndex(i)}
                        className={clsx(
                          'w-20 h-20 rounded-lg overflow-hidden shrink-0 transition-all artisan-frame',
                          i === galleryIndex ? 'ring-2 ring-[#c9a84c] scale-105' : 'opacity-60 hover:opacity-100'
                        )}>
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="aspect-square bg-[#2a1f0e] rounded-lg flex items-center justify-center artisan-frame">
                <Package className="w-20 h-20 text-[#a89070]/30" />
              </div>
            )}
          </div>
        );
      }
      return (
        <div className="px-4 md:px-8 py-8 max-w-3xl mx-auto">
          {images.length > 0 ? (
            <>
              <div className="rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-700/50 mb-3">
                <img src={images[galleryIndex] || images[0]} alt={product.name} className="w-full aspect-square object-contain" />
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 justify-center overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button key={i} onClick={() => setGalleryIndex(i)}
                      className={clsx('w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-colors',
                        i === galleryIndex ? 'border-blue-500' : 'border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      )}>
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
              <Package className="w-20 h-20 text-gray-300 dark:text-gray-600" />
            </div>
          )}
        </div>
      );

    // ── VARIANT SELECTOR ─────────────────────────────────────────────────
    case 'variantSelector':
      if (!variants.length) return null;
      const vStyle = variantDisplay?.style || 'buttons';
      if (isArtisan) {
        return (
          <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto">
            <h3 className="font-bold text-sm mb-3" style={{ color: primaryColor }}>Choose Option:</h3>
            <div className="flex flex-wrap gap-2">
              {variants.map(v => {
                const isSelected = selectedVariant?._id === v._id;
                const label = Object.values(v.attributes || {}).join(' / ');
                return (
                  <button
                    key={v._id}
                    onClick={() => { setSelectedVariant(v); trackEvent('product_view', { variantId: v._id }); }}
                    className={clsx(
                      'px-5 py-3 rounded-lg text-sm font-medium border-2 transition-all',
                      isSelected
                        ? 'border-[#c9a84c] text-[#1a1208] bg-[#c9a84c]'
                        : 'border-[#c9a84c]/30 text-[#e8dcc8] hover:border-[#c9a84c]/60 bg-transparent'
                    )}
                  >
                    {label}
                    {variantDisplay?.showPrice && <span className="ms-1.5 text-xs opacity-80">{v.price} DA</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }
      return (
        <div className="px-4 md:px-8 py-4 max-w-3xl mx-auto">
          <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-3">Choose Option:</h3>
          {vStyle === 'dropdown' ? (
            <select
              value={selectedVariant?._id || ''}
              onChange={e => setSelectedVariant(variants.find(v => v._id === e.target.value))}
              className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
            >
              {variants.map(v => (
                <option key={v._id} value={v._id}>
                  {Object.values(v.attributes || {}).join(' / ')} — {v.price} DA
                </option>
              ))}
            </select>
          ) : (
            <div className={clsx('flex flex-wrap gap-2', vStyle === 'grid' && 'grid grid-cols-2 sm:grid-cols-3')}>
              {variants.map(v => {
                const isSelected = selectedVariant?._id === v._id;
                const label = Object.values(v.attributes || {}).join(' / ');
                return (
                  <button
                    key={v._id}
                    onClick={() => { setSelectedVariant(v); trackEvent('product_view', { variantId: v._id }); }}
                    className={clsx(
                      'px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
                      vStyle === 'cards' && 'flex-1 min-w-[120px] p-4 text-center',
                      isSelected
                        ? 'text-white shadow-md'
                        : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 bg-white dark:bg-gray-800'
                    )}
                    style={isSelected ? { borderColor: primaryColor, backgroundColor: primaryColor } : {}}
                  >
                    {vStyle === 'cards' ? (
                      <div>
                        <p className="font-bold text-sm">{label}</p>
                        {variantDisplay?.showPrice && <p className="text-xs mt-1">{v.price} DA</p>}
                        {variantDisplay?.showStock && v.available && <p className="text-[10px] mt-0.5 opacity-70">In stock</p>}
                      </div>
                    ) : (
                      <>
                        {label}
                        {variantDisplay?.showPrice && <span className="ms-1 text-xs opacity-80">{v.price} DA</span>}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );

    // ── COD FORM ─────────────────────────────────────────────────────────
    case 'codForm':
      if (isArtisan) {
        return (
          <div ref={formRef} className="px-4 md:px-8 py-10 max-w-xl mx-auto" id="codForm">
            <form onSubmit={handleSubmit} className="rounded-xl p-6 md:p-8 border-2 border-[#c9a84c]/30 bg-[#2a1f0e]/80">
              <h3 className="text-xl font-bold text-center mb-6" style={{ color: primaryColor }}>
                {formConfig?.submitButtonText || 'Order Now'}
              </h3>
              <div className="artisan-gold-divider" style={{ marginTop: '-0.5rem', marginBottom: '1.5rem' }} />

              <div className="space-y-4">
                <ArtisanFormField label="Full Name" error={formErrors.customerName}
                  value={formData.customerName} onChange={v => updateForm('customerName', v)} placeholder="Ahmed Mohamed" />

                <ArtisanFormField label="Phone Number" error={formErrors.phone}
                  value={formData.phone} onChange={v => updateForm('phone', v)} placeholder="05XX XXX XXX" type="tel" />

                {formConfig?.fields?.phone2?.visible !== false && (
                  <ArtisanFormField label="Secondary Phone (optional)"
                    value={formData.phone2} onChange={v => updateForm('phone2', v)} placeholder="Optional" />
                )}

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#a89070' }}>Wilaya *</label>
                  <select
                    value={formData.wilayaCode}
                    onChange={e => {
                      const opt = e.target.options[e.target.selectedIndex];
                      updateForm('wilayaCode', e.target.value);
                      updateForm('wilayaName', opt.dataset.name || '');
                      updateForm('commune', '');
                      setCommunes([]);
                    }}
                    className={clsx('artisan-select', formErrors.wilayaCode && '!border-red-500')}
                  >
                    <option value="">Select wilaya...</option>
                    {WILAYAS.map(w => (
                      <option key={w.code} value={w.code} data-name={w.name}>{w.code} - {w.name}</option>
                    ))}
                  </select>
                  {formErrors.wilayaCode && <p className="text-xs text-red-400 mt-0.5">{formErrors.wilayaCode}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#a89070' }}>Commune *</label>
                  <select
                    value={formData.commune}
                    onChange={e => updateForm('commune', e.target.value)}
                    disabled={!communes.length}
                    className={clsx('artisan-select', formErrors.commune && '!border-red-500')}
                  >
                    <option value="">Select commune...</option>
                    {communes.map((c, i) => (
                      <option key={i} value={c.commune}>{c.commune}{c.officeSupported ? ' (Home + Office)' : ' (Home)'}</option>
                    ))}
                  </select>
                  {formErrors.commune && <p className="text-xs text-red-400 mt-0.5">{formErrors.commune}</p>}
                </div>

                <ArtisanFormField label="Address"
                  value={formData.address} onChange={v => updateForm('address', v)} placeholder="Street, building, floor..." />

                {formConfig?.fields?.deliveryType?.visible !== false && (
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#a89070' }}>Delivery Type</label>
                    <div className="flex gap-2">
                      {[{ value: 0, label: 'Home Delivery' }, { value: 1, label: 'Office / Stop Desk' }].map(dt => (
                        <button key={dt.value} type="button"
                          onClick={() => updateForm('deliveryType', dt.value)}
                          className={clsx('flex-1 py-2.5 rounded-lg text-xs font-medium border-2 transition-colors',
                            formData.deliveryType === dt.value
                              ? 'border-[#c9a84c] bg-[#c9a84c] text-[#1a1208]'
                              : 'border-[#c9a84c]/30 text-[#a89070] bg-transparent'
                          )}>
                          {dt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {formConfig?.fields?.quantity?.visible !== false && (
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#a89070' }}>Quantity</label>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-8 h-8 rounded-lg border border-[#c9a84c]/30 flex items-center justify-center text-[#c9a84c] hover:bg-[#c9a84c]/10">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-lg font-bold min-w-[2ch] text-center text-[#e8dcc8]">{quantity}</span>
                      <button type="button" onClick={() => setQuantity(Math.min(formConfig?.maxQuantity || 10, quantity + 1))}
                        className="w-8 h-8 rounded-lg border border-[#c9a84c]/30 flex items-center justify-center text-[#c9a84c] hover:bg-[#c9a84c]/10">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Price Summary */}
                <div className="rounded-xl p-4 space-y-2 mt-4 bg-[#1a1208] border border-[#c9a84c]/20">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#a89070]">Price:</span>
                    <div className="flex items-center gap-2">
                      {hasDiscount && <span className="line-through text-[#a89070]/50 text-xs">{originalPrice} DA</span>}
                      <span className="font-bold text-[#e8dcc8]">{unitPrice} DA</span>
                    </div>
                  </div>
                  {quantity > 1 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#a89070]">Subtotal ({quantity}x):</span>
                      <span className="font-bold text-[#e8dcc8]">{subtotal} DA</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-[#a89070]">Delivery:</span>
                    <span className="font-bold text-[#e8dcc8]">{deliveryPrice !== null ? `${deliveryPrice} DA` : '—'}</span>
                  </div>
                  <div className="border-t border-[#c9a84c]/20 pt-2 flex justify-between">
                    <span className="font-bold text-[#e8dcc8]">Total:</span>
                    <span className="text-xl font-extrabold" style={{ color: primaryColor }}>{totalPrice} DA</span>
                  </div>
                </div>

                {formErrors.submit && (
                  <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
                    {formErrors.submit}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-lg artisan-btn-filled text-lg disabled:opacity-70"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                    </span>
                  ) : (
                    formConfig?.submitButtonText || 'Confirm Order'
                  )}
                </button>
              </div>
            </form>
          </div>
        );
      }
      return (
        <div ref={formRef} className="px-4 md:px-8 py-8 max-w-xl mx-auto" id="codForm">
          <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="text-xl font-bold text-center mb-5" style={{ color: primaryColor }}>
              {formConfig?.submitButtonText ? `${formConfig.submitButtonText}` : 'Order Now — Cash on Delivery'}
            </h3>

            <div className="space-y-3">
              <FormField icon={User} label="Full Name" error={formErrors.customerName}
                value={formData.customerName} onChange={v => updateForm('customerName', v)} placeholder="Ahmed Mohamed" />

              <FormField icon={Phone} label="Phone Number" error={formErrors.phone}
                value={formData.phone} onChange={v => updateForm('phone', v)} placeholder="05XX XXX XXX" type="tel" />

              {formConfig?.fields?.phone2?.visible !== false && (
                <FormField icon={Phone} label="Secondary Phone (optional)"
                  value={formData.phone2} onChange={v => updateForm('phone2', v)} placeholder="Optional" />
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Wilaya *</label>
                <select
                  value={formData.wilayaCode}
                  onChange={e => {
                    const opt = e.target.options[e.target.selectedIndex];
                    updateForm('wilayaCode', e.target.value);
                    updateForm('wilayaName', opt.dataset.name || '');
                    updateForm('commune', '');
                    setCommunes([]);
                  }}
                  className={clsx('w-full px-3 py-2.5 rounded-xl border text-sm dark:bg-gray-700 dark:text-gray-100', formErrors.wilayaCode ? 'border-red-400' : 'border-gray-200 dark:border-gray-600')}
                >
                  <option value="">Select wilaya...</option>
                  {WILAYAS.map(w => (
                    <option key={w.code} value={w.code} data-name={w.name}>{w.code} - {w.name}</option>
                  ))}
                </select>
                {formErrors.wilayaCode && <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{formErrors.wilayaCode}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Commune *</label>
                <select
                  value={formData.commune}
                  onChange={e => updateForm('commune', e.target.value)}
                  disabled={!communes.length}
                  className={clsx('w-full px-3 py-2.5 rounded-xl border text-sm dark:bg-gray-700 dark:text-gray-100', formErrors.commune ? 'border-red-400' : 'border-gray-200 dark:border-gray-600')}
                >
                  <option value="">Select commune...</option>
                  {communes.map((c, i) => (
                    <option key={i} value={c.commune}>{c.commune}{c.officeSupported ? ' (Home + Office)' : ' (Home)'}</option>
                  ))}
                </select>
                {formErrors.commune && <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{formErrors.commune}</p>}
              </div>

              <FormField icon={MapPin} label="Address"
                value={formData.address} onChange={v => updateForm('address', v)} placeholder="Street, building, floor..." />

              {formConfig?.fields?.deliveryType?.visible !== false && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Delivery Type</label>
                  <div className="flex gap-2">
                    {[{ value: 0, label: 'Home Delivery' }, { value: 1, label: 'Office / Stop Desk' }].map(dt => (
                      <button key={dt.value} type="button"
                        onClick={() => updateForm('deliveryType', dt.value)}
                        className={clsx('flex-1 py-2 rounded-xl text-xs font-medium border-2 transition-colors',
                          formData.deliveryType === dt.value
                            ? 'text-white'
                            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700'
                        )}
                        style={formData.deliveryType === dt.value ? { borderColor: primaryColor, backgroundColor: primaryColor } : {}}>
                        {dt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formConfig?.fields?.quantity?.visible !== false && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Quantity</label>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600 dark:text-gray-300">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-lg font-bold min-w-[2ch] text-center dark:text-gray-100">{quantity}</span>
                    <button type="button" onClick={() => setQuantity(Math.min(formConfig?.maxQuantity || 10, quantity + 1))}
                      className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600 dark:text-gray-300">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {formConfig?.fields?.notes?.visible && (
                <FormField label="Notes (optional)"
                  value={formData.notes} onChange={v => updateForm('notes', v)} placeholder="Any special instructions..." multiline />
              )}

              {/* Price Summary */}
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 space-y-2 mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Price:</span>
                  <div className="flex items-center gap-2">
                    {hasDiscount && <span className="line-through text-gray-400 dark:text-gray-500 text-xs">{originalPrice} DA</span>}
                    <span className="font-bold dark:text-gray-100">{unitPrice} DA</span>
                  </div>
                </div>
                {quantity > 1 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Subtotal ({quantity}x):</span>
                    <span className="font-bold dark:text-gray-100">{subtotal} DA</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Delivery:</span>
                  <span className="font-bold dark:text-gray-100">{deliveryPrice !== null ? `${deliveryPrice} DA` : '—'}</span>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 pt-2 flex justify-between">
                  <span className="font-bold dark:text-gray-100">Total:</span>
                  <span className="text-xl font-extrabold" style={{ color: primaryColor }}>{totalPrice} DA</span>
                </div>
              </div>

              {formErrors.submit && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
                  {formErrors.submit}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-xl hover:shadow-2xl active:scale-[0.98] transition-all disabled:opacity-70"
                style={{ backgroundColor: primaryColor }}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                  </span>
                ) : (
                  formConfig?.submitButtonText || 'Confirm Order'
                )}
              </button>
            </div>
          </form>
        </div>
      );

    // ── BENEFITS ─────────────────────────────────────────────────────────
    case 'benefits':
      if (isArtisan) {
        return (
          <div className="px-4 md:px-8 py-12 max-w-4xl mx-auto">
            <div className="artisan-gold-divider" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
              {(s.items || []).map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-3">
                  {/* Circular gold-framed icon */}
                  <div className="artisan-circle-frame w-24 h-24 flex items-center justify-center">
                    {s.backgroundImage ? (
                      <img src={safeMediaUrl(s.backgroundImage)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full rounded-full flex items-center justify-center bg-[#1a1208]">
                        <Check className="w-8 h-8" style={{ color: primaryColor }} />
                      </div>
                    )}
                  </div>
                  <h4 className="font-bold text-sm" style={{ color: '#e8dcc8' }}>{item.title}</h4>
                  {item.description && <p className="text-xs" style={{ color: '#a89070' }}>{item.description}</p>}
                </div>
              ))}
            </div>
            <div className="artisan-gold-divider" />
          </div>
        );
      }
      return (
        <div className="px-4 md:px-8 py-8 max-w-3xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(s.items || []).map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">{item.title}</h4>
                  {item.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    // ── TESTIMONIALS ─────────────────────────────────────────────────────
    case 'testimonials':
      if (isArtisan) {
        return (
          <div className="px-4 md:px-8 py-12 relative" style={s.backgroundImage ? {
            background: `linear-gradient(rgba(26,18,8,0.85), rgba(26,18,8,0.9)), url(${safeMediaUrl(s.backgroundImage)}) center/cover`
          } : {}}>
            <div className="max-w-3xl mx-auto relative">
              <div className="rounded-xl p-6 md:p-8 border border-[#c9a84c]/20 bg-[#2a1f0e]/60">
                {(s.items || []).map((item, i) => (
                  <div key={i} className={clsx('text-center', i > 0 && 'mt-8 pt-8 border-t border-[#c9a84c]/10')}>
                    {/* Quote icon */}
                    <div className="flex justify-center mb-4">
                      <Quote className="w-8 h-8" style={{ color: primaryColor }} />
                    </div>
                    {/* Stars */}
                    <div className="flex justify-center mb-3">
                      {Array.from({ length: item.rating || 5 }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-current" style={{ color: primaryColor }} />
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: '#e8dcc8' }}>"{item.text}"</p>
                    {/* Avatar + name */}
                    <div className="flex items-center justify-center gap-3">
                      <div className="artisan-circle-frame w-12 h-12">
                        <div className="w-full h-full rounded-full bg-[#1a1208] flex items-center justify-center">
                          <User className="w-5 h-5" style={{ color: primaryColor }} />
                        </div>
                      </div>
                      <span className="font-bold text-sm" style={{ color: primaryColor }}>{item.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className="px-4 md:px-8 py-10 relative" style={s.backgroundImage ? {
          background: `linear-gradient(rgba(249,250,251,0.88), rgba(249,250,251,0.92)), url(${safeMediaUrl(s.backgroundImage)}) center/cover`
        } : { backgroundColor: '#f9fafb' }}>
          <h3 className="font-bold text-xl text-center mb-6 text-gray-900 dark:text-white relative">What our customers say</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto relative">
            {(s.items || []).map((item, i) => (
              <div key={i} className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-5 rounded-2xl shadow-sm">
                <div className="flex mb-2">
                  {Array.from({ length: item.rating || 5 }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">"{item.text}"</p>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{item.name}</p>
              </div>
            ))}
          </div>
        </div>
      );

    // ── FAQ ───────────────────────────────────────────────────────────────
    case 'faq':
      if (isArtisan) {
        return (
          <div className="px-4 md:px-8 py-10 max-w-2xl mx-auto relative" style={s.backgroundImage ? {
            background: `linear-gradient(rgba(26,18,8,0.88), rgba(26,18,8,0.92)), url(${safeMediaUrl(s.backgroundImage)}) center/cover`,
            borderRadius: '1rem', margin: '0 auto', maxWidth: '42rem'
          } : {}}>
            <h3 className="font-bold text-xl text-center mb-6" style={{ color: '#e8dcc8' }}>Frequently Asked Questions</h3>
            <div className="artisan-gold-divider" style={{ marginTop: '-0.5rem', marginBottom: '1.5rem' }} />
            <div className="space-y-2">
              {(s.items || []).map((item, i) => (
                <div key={i} className="border border-[#c9a84c]/20 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 text-start hover:bg-[#c9a84c]/5 transition-colors"
                  >
                    <span className="font-medium text-sm" style={{ color: '#e8dcc8' }}>{item.question}</span>
                    <ChevronDown className={clsx('w-4 h-4 shrink-0 transition-transform', openFaq === i && 'rotate-180')} style={{ color: primaryColor }} />
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4 text-sm" style={{ color: '#a89070' }}>{item.answer}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      }
      return (
        <div className="px-4 md:px-8 py-10 max-w-2xl mx-auto relative" style={s.backgroundImage ? {
          background: `linear-gradient(rgba(255,255,255,0.92), rgba(255,255,255,0.95)), url(${safeMediaUrl(s.backgroundImage)}) center/cover`,
          borderRadius: '1rem', padding: '2rem'
        } : {}}>
          <h3 className="font-bold text-xl text-center mb-6 text-gray-900 dark:text-white relative">Frequently Asked Questions</h3>
          <div className="space-y-2 relative">
            {(s.items || []).map((item, i) => (
              <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-start hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="font-medium text-sm text-gray-900 dark:text-white">{item.question}</span>
                  <ChevronDown className={clsx('w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0 transition-transform', openFaq === i && 'rotate-180')} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400">{item.answer}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      );

    // ── CTA ───────────────────────────────────────────────────────────────
    case 'cta':
      if (isArtisan) {
        return (
          <div className="px-4 py-10 text-center relative" style={s.backgroundImage ? {
            background: `linear-gradient(rgba(26,18,8,0.7), rgba(26,18,8,0.8)), url(${safeMediaUrl(s.backgroundImage)}) center/cover`
          } : {}}>
            <button
              onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="artisan-btn rounded-lg text-lg relative"
            >
              {s.text || 'Order Now'}
            </button>
          </div>
        );
      }
      return (
        <div className="px-4 py-8 text-center relative" style={s.backgroundImage ? {
          background: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url(${safeMediaUrl(s.backgroundImage)}) center/cover`,
          padding: '3rem 1rem'
        } : {}}>
          <button
            onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="px-10 py-4 rounded-xl text-white font-bold text-lg shadow-xl hover:scale-105 active:scale-95 transition-transform relative"
            style={{ backgroundColor: s.style === 'accent' ? accentColor : primaryColor }}
          >
            {s.text || 'Order Now'}
          </button>
        </div>
      );

    // ── GUARANTEE ────────────────────────────────────────────────────────
    case 'guarantee':
      if (isArtisan) {
        return (
          <div className="px-4 md:px-8 py-6 max-w-xl mx-auto">
            <div className="flex items-center gap-4 p-5 rounded-xl border border-[#c9a84c]/30 bg-[#2a1f0e]/60">
              {s.badgeImage ? (
                <img src={safeMediaUrl(s.badgeImage)} alt="" className="w-14 h-14 object-contain shrink-0" />
              ) : (
                <Shield className="w-12 h-12 shrink-0" style={{ color: primaryColor }} />
              )}
              <div>
                <h4 className="font-bold" style={{ color: '#e8dcc8' }}>{s.title || 'Money Back Guarantee'}</h4>
                <p className="text-sm mt-0.5" style={{ color: '#a89070' }}>{s.description}</p>
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className="px-4 md:px-8 py-6 max-w-xl mx-auto">
          <div className="flex items-center gap-4 p-5 rounded-2xl border-2 border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
            <Shield className="w-12 h-12 text-green-600 dark:text-green-400 shrink-0" />
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white">{s.title || 'Money Back Guarantee'}</h4>
              <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">{s.description}</p>
            </div>
          </div>
        </div>
      );

    // ── COUNTDOWN ────────────────────────────────────────────────────────
    case 'countdown':
      return <CountdownBlock settings={s} primaryColor={primaryColor} isArtisan={isArtisan} />;

    // ── TRUST BADGES ────────────────────────────────────────────────────
    case 'trustBadges':
      if (isArtisan) {
        return (
          <div className="px-4 py-8">
            <div className="flex flex-wrap justify-center gap-8">
              {(s.badges || []).map((badge, i) => {
                const BADGE_MAP = {
                  'secure': { icon: Shield, label: 'Secure Payment' },
                  'cod': { icon: ShoppingCart, label: 'Cash on Delivery' },
                  'fast-delivery': { icon: Truck, label: 'Fast Delivery' },
                  'guarantee': { icon: Shield, label: 'Satisfaction Guaranteed' },
                  'original': { icon: Check, label: '100% Original' },
                  'warranty': { icon: Shield, label: 'Warranty' }
                };
                const b = BADGE_MAP[badge] || { icon: Shield, label: badge };
                const Icon = b.icon;
                return (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className="artisan-circle-frame w-14 h-14">
                      <div className="w-full h-full rounded-full bg-[#1a1208] flex items-center justify-center">
                        <Icon className="w-6 h-6" style={{ color: primaryColor }} />
                      </div>
                    </div>
                    <span className="text-[11px] text-center font-medium" style={{ color: '#a89070' }}>{b.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
      return (
        <div className="px-4 py-6">
          <div className="flex flex-wrap justify-center gap-6">
            {(s.badges || []).map((badge, i) => {
              const BADGE_MAP = {
                'secure': { icon: Shield, label: 'Secure Payment' },
                'cod': { icon: ShoppingCart, label: 'Cash on Delivery' },
                'fast-delivery': { icon: Truck, label: 'Fast Delivery' },
                'guarantee': { icon: Shield, label: 'Satisfaction Guaranteed' },
                'original': { icon: Check, label: '100% Original' },
                'warranty': { icon: Shield, label: 'Warranty' }
              };
              const b = BADGE_MAP[badge] || { icon: Shield, label: badge };
              const Icon = b.icon;
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  </div>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 text-center font-medium">{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      );

    // ── DELIVERY INFO ────────────────────────────────────────────────────
    case 'deliveryInfo':
      if (isArtisan) {
        return (
          <div className="px-4 md:px-8 py-6 max-w-xl mx-auto relative" style={s.backgroundImage ? {
            background: `linear-gradient(rgba(26,18,8,0.85), rgba(26,18,8,0.9)), url(${safeMediaUrl(s.backgroundImage)}) center/cover`,
            borderRadius: '0.75rem'
          } : {}}>
            <div className="rounded-xl p-5 border border-[#c9a84c]/20 bg-[#2a1f0e]/60 relative">
              <div className="flex items-center gap-3 mb-3">
                <Truck className="w-7 h-7" style={{ color: primaryColor }} />
                <h4 className="font-bold" style={{ color: '#e8dcc8' }}>{s.title || 'Delivery Information'}</h4>
              </div>
              <div className="space-y-1.5 text-sm" style={{ color: '#a89070' }}>
                <p>Coverage: {s.wilayas || 'All 58 wilayas'}</p>
                <p>Estimated: {s.timeframe || '2-5 business days'}</p>
                <p>Payment: Cash on Delivery</p>
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className="px-4 md:px-8 py-6 max-w-xl mx-auto relative" style={s.backgroundImage ? {
          background: `linear-gradient(rgba(239,246,255,0.88), rgba(239,246,255,0.92)), url(${safeMediaUrl(s.backgroundImage)}) center/cover`,
          borderRadius: '1rem'
        } : {}}>
          <div className="bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-sm rounded-2xl p-5 relative">
            <div className="flex items-center gap-3 mb-3">
              <Truck className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              <h4 className="font-bold text-blue-800 dark:text-blue-300">{s.title || 'Delivery Information'}</h4>
            </div>
            <div className="space-y-1.5 text-sm text-blue-700 dark:text-blue-300">
              <p>Coverage: {s.wilayas || 'All 58 wilayas'}</p>
              <p>Estimated: {s.timeframe || '2-5 business days'}</p>
              <p>Payment: Cash on Delivery</p>
            </div>
          </div>
        </div>
      );

    // ── STOCK SCARCITY ───────────────────────────────────────────────────
    case 'stockScarcity':
      if (isArtisan) {
        return (
          <div className="px-4 md:px-8 py-4 max-w-xl mx-auto relative" style={s.backgroundImage ? {
            background: `linear-gradient(rgba(26,18,8,0.8), rgba(26,18,8,0.85)), url(${safeMediaUrl(s.backgroundImage)}) center/cover`,
            borderRadius: '0.75rem'
          } : {}}>
            <div className="flex items-center gap-2 p-3 rounded-xl border border-[#c9a84c]/30 bg-[#2a1f0e]/60 relative">
              <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: primaryColor }} />
              <span className="text-sm font-medium" style={{ color: '#e8dcc8' }}>
                {(s.message || 'Only {count} left!').replace('{count}', s.count || 12)}
              </span>
            </div>
            {s.showBar && (
              <div className="mt-2 h-2 rounded-full overflow-hidden bg-[#2a1f0e]">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, ((s.count || 12) / 50) * 100)}%`, backgroundColor: primaryColor }} />
              </div>
            )}
          </div>
        );
      }
      return (
        <div className="px-4 md:px-8 py-4 max-w-xl mx-auto relative" style={s.backgroundImage ? {
          background: `linear-gradient(rgba(254,242,242,0.85), rgba(254,242,242,0.9)), url(${safeMediaUrl(s.backgroundImage)}) center/cover`,
          borderRadius: '0.75rem'
        } : {}}>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border border-red-200 dark:border-red-500/30 relative">
            <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">
              {(s.message || 'Only {count} left!').replace('{count}', s.count || 12)}
            </span>
          </div>
          {s.showBar && (
            <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${Math.min(100, ((s.count || 12) / 50) * 100)}%` }} />
            </div>
          )}
        </div>
      );

    // ── TEXT ──────────────────────────────────────────────────────────────
    case 'text':
      return (
        <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto" style={{ textAlign: s.alignment || 'center' }}>
          <div className={clsx(
            'text-sm leading-relaxed whitespace-pre-wrap',
            isArtisan ? 'text-[#a89070]' : 'text-gray-700 dark:text-gray-300'
          )}>{s.content}</div>
        </div>
      );

    // ── IMAGE ────────────────────────────────────────────────────────────
    case 'image':
      return safeMediaUrl(s.url) ? (
        <div className={s.fullWidth ? '' : 'px-4 md:px-8 py-4 max-w-3xl mx-auto'}>
          <img src={safeMediaUrl(s.url)} alt={s.alt || ''} className={clsx(
            'w-full object-cover',
            !s.fullWidth && (isArtisan ? 'rounded-lg artisan-frame' : 'rounded-2xl')
          )} />
        </div>
      ) : null;

    // ── VIDEO ────────────────────────────────────────────────────────────
    case 'video':
      return safeMediaUrl(s.url) ? (
        <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto">
          <div className={clsx('aspect-video overflow-hidden', isArtisan ? 'rounded-lg artisan-frame' : 'rounded-2xl')}>
            <iframe src={safeMediaUrl(s.url)} className="w-full h-full" allow="autoplay; fullscreen" sandbox="allow-scripts allow-same-origin" title="Video" />
          </div>
        </div>
      ) : null;

    // ── REVIEWS ──────────────────────────────────────────────────────────
    case 'reviews':
      return (
        <div className="px-4 md:px-8 py-8 max-w-2xl mx-auto">
          <h3 className={clsx('font-bold text-xl text-center mb-6', isArtisan ? 'text-[#e8dcc8]' : 'text-gray-900 dark:text-white')}>Customer Reviews</h3>
          <div className="space-y-3">
            {(s.items || []).map((item, i) => (
              <div key={i} className={clsx(
                'rounded-xl p-4',
                isArtisan ? 'border border-[#c9a84c]/20 bg-[#2a1f0e]/60' : 'border border-gray-100 dark:border-gray-700 dark:bg-gray-800'
              )}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={clsx('font-bold text-sm', isArtisan ? 'text-[#e8dcc8]' : 'text-gray-800 dark:text-gray-200')}>{item.name}</span>
                  <div className="flex">{Array.from({ length: item.rating || 5 }).map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-current" style={{ color: isArtisan ? primaryColor : '#facc15' }} />
                  ))}</div>
                </div>
                <p className={clsx('text-sm', isArtisan ? 'text-[#a89070]' : 'text-gray-600 dark:text-gray-400')}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      );

    // ── SPACER ───────────────────────────────────────────────────────────
    case 'spacer':
      return <div style={{ height: s.height || 40 }} />;

    default:
      return null;
  }
}

// ── Artisan Form Field ──────────────────────────────────────────────────────

function ArtisanFormField({ label, value, onChange, placeholder, error, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#a89070' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={clsx('artisan-input', error && '!border-red-500')}
      />
      {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
    </div>
  );
}

// ── Form Field (standard) ───────────────────────────────────────────────────

function FormField({ icon: Icon, label, value, onChange, placeholder, error, type = 'text', multiline }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />}
        {multiline ? (
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            rows={2}
            className={clsx('w-full px-3 py-2.5 rounded-xl border text-sm resize-none dark:bg-gray-700 dark:text-gray-100', Icon && 'ps-10', error ? 'border-red-400' : 'border-gray-200 dark:border-gray-600')}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className={clsx('w-full px-3 py-2.5 rounded-xl border text-sm dark:bg-gray-700 dark:text-gray-100', Icon && 'ps-10', error ? 'border-red-400' : 'border-gray-200 dark:border-gray-600')}
          />
        )}
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{error}</p>}
    </div>
  );
}

// ── Countdown ───────────────────────────────────────────────────────────────

function CountdownBlock({ settings, primaryColor, isArtisan }) {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    if (!settings.endDate) return;
    const target = new Date(settings.endDate).getTime();
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000)
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [settings.endDate]);

  return (
    <div className={clsx('px-4 py-8 text-center', isArtisan && !settings.backgroundImage && 'bg-[#2a1f0e]/50')}
      style={settings.backgroundImage ? {
        background: isArtisan
          ? `linear-gradient(rgba(26,18,8,0.75), rgba(26,18,8,0.85)), url(${safeMediaUrl(settings.backgroundImage)}) center/cover`
          : `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.65)), url(${safeMediaUrl(settings.backgroundImage)}) center/cover`
      } : {}}>
      <p className="text-sm font-semibold mb-4 relative" style={{ color: settings.backgroundImage && !isArtisan ? '#fff' : primaryColor }}>{settings.label || 'Offer ends in'}</p>
      <div className="flex justify-center gap-3">
        {[
          { val: String(time.d).padStart(2, '0'), label: 'Days' },
          { val: String(time.h).padStart(2, '0'), label: 'Hours' },
          { val: String(time.m).padStart(2, '0'), label: 'Min' },
          { val: String(time.s).padStart(2, '0'), label: 'Sec' }
        ].map((u, i) => (
          <div key={i} className={clsx(
            'rounded-xl shadow-md px-5 py-3 min-w-[65px]',
            isArtisan ? 'bg-[#1a1208] border border-[#c9a84c]/20' : 'bg-white dark:bg-gray-800'
          )}>
            <p className="text-2xl font-extrabold" style={{ color: primaryColor }}>{u.val}</p>
            <p className={clsx('text-[10px] uppercase font-medium', isArtisan ? 'text-[#a89070]' : 'text-gray-500 dark:text-gray-400')}>{u.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getVisitorId() {
  let id = localStorage.getItem('_vid');
  if (!id) { id = Math.random().toString(36).substring(2) + Date.now().toString(36); localStorage.setItem('_vid', id); }
  return id;
}

// Validate pixel IDs to prevent XSS via script injection
const PIXEL_ID_RE = /^[A-Za-z0-9_-]{3,60}$/;
const safePixelId = (id) => (typeof id === 'string' && PIXEL_ID_RE.test(id)) ? id : null;

function injectPixels(pixels) {
  if (!pixels) return;
  // Sanitize all pixel IDs before interpolating into script tags
  const metaId = safePixelId(pixels.metaPixelId);
  const tiktokId = safePixelId(pixels.tiktokPixelId);
  const gaId = safePixelId(pixels.googleAnalyticsId);
  if (metaId && !window.fbq) {
    const script = document.createElement('script');
    script.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaId}');fbq('track','PageView');`;
    document.head.appendChild(script);
  }
  if (tiktokId && !window.ttq) {
    const script = document.createElement('script');
    script.innerHTML = `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tiktokId}');ttq.page();}(window,document,'ttq');`;
    document.head.appendChild(script);
  }
  if (gaId && !window.gtag) {
    const s1 = document.createElement('script');
    s1.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    s1.async = true;
    document.head.appendChild(s1);
    const s2 = document.createElement('script');
    s2.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`;
    document.head.appendChild(s2);
  }
}

function firePixelEvent(eventName, data = {}) {
  if (window.fbq) window.fbq('track', eventName, data);
  if (window.ttq) window.ttq.track(eventName, data);
  if (window.gtag) window.gtag('event', eventName.toLowerCase(), data);
}

// Algeria wilayas list (code + name)
const WILAYAS = [
  { code: '1', name: 'Adrar' }, { code: '2', name: 'Chlef' }, { code: '3', name: 'Laghouat' },
  { code: '4', name: 'Oum El Bouaghi' }, { code: '5', name: 'Batna' }, { code: '6', name: 'Bejaia' },
  { code: '7', name: 'Biskra' }, { code: '8', name: 'Bechar' }, { code: '9', name: 'Blida' },
  { code: '10', name: 'Bouira' }, { code: '11', name: 'Tamanrasset' }, { code: '12', name: 'Tebessa' },
  { code: '13', name: 'Tlemcen' }, { code: '14', name: 'Tiaret' }, { code: '15', name: 'Tizi Ouzou' },
  { code: '16', name: 'Alger' }, { code: '17', name: 'Djelfa' }, { code: '18', name: 'Jijel' },
  { code: '19', name: 'Setif' }, { code: '20', name: 'Saida' }, { code: '21', name: 'Skikda' },
  { code: '22', name: 'Sidi Bel Abbes' }, { code: '23', name: 'Annaba' }, { code: '24', name: 'Guelma' },
  { code: '25', name: 'Constantine' }, { code: '26', name: 'Medea' }, { code: '27', name: 'Mostaganem' },
  { code: '28', name: 'M\'sila' }, { code: '29', name: 'Mascara' }, { code: '30', name: 'Ouargla' },
  { code: '31', name: 'Oran' }, { code: '32', name: 'El Bayadh' }, { code: '33', name: 'Illizi' },
  { code: '34', name: 'Bordj Bou Arreridj' }, { code: '35', name: 'Boumerdes' }, { code: '36', name: 'El Tarf' },
  { code: '37', name: 'Tindouf' }, { code: '38', name: 'Tissemsilt' }, { code: '39', name: 'El Oued' },
  { code: '40', name: 'Khenchela' }, { code: '41', name: 'Souk Ahras' }, { code: '42', name: 'Tipaza' },
  { code: '43', name: 'Mila' }, { code: '44', name: 'Ain Defla' }, { code: '45', name: 'Naama' },
  { code: '46', name: 'Ain Temouchent' }, { code: '47', name: 'Ghardaia' }, { code: '48', name: 'Relizane' },
  { code: '49', name: 'El M\'Ghair' }, { code: '50', name: 'El Meniaa' }, { code: '51', name: 'Ouled Djellal' },
  { code: '52', name: 'Bordj Badji Mokhtar' }, { code: '53', name: 'Beni Abbes' }, { code: '54', name: 'Timimoun' },
  { code: '55', name: 'Touggourt' }, { code: '56', name: 'Djanet' }, { code: '57', name: 'In Salah' },
  { code: '58', name: 'In Guezzam' }
];
