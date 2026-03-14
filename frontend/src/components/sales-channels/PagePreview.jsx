import {
  Star, Shield, Truck, Clock, Check, Package, ShoppingCart,
  ChevronDown, AlertTriangle, Play, HelpCircle, MessageSquare
} from 'lucide-react';
import clsx from 'clsx';

/**
 * Live preview of the landing page inside the builder.
 * Renders blocks in order with placeholder styling.
 */
export default function PagePreview({ page, blocks }) {
  const theme = page?.theme || {};
  const primaryColor = theme.primaryColor || '#2563eb';
  const accentColor = theme.accentColor || '#f59e0b';
  const bgColor = theme.backgroundColor || '#ffffff';
  const textColor = theme.textColor || '#1f2937';

  const visibleBlocks = blocks.filter(b => b.isVisible);

  return (
    <div style={{ backgroundColor: bgColor, color: textColor, fontFamily: 'Inter, sans-serif' }} className="min-h-[600px]">
      {visibleBlocks.map((block) => (
        <div key={block.id} className="relative group">
          {/* Block type badge on hover */}
          <div className="absolute top-1 start-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded uppercase">
              {block.type}
            </span>
          </div>
          <div className="group-hover:ring-2 group-hover:ring-blue-400 group-hover:ring-inset transition-all">
            <BlockRenderer block={block} theme={{ primaryColor, accentColor, bgColor, textColor }} />
          </div>
        </div>
      ))}

      {visibleBlocks.length === 0 && (
        <div className="flex items-center justify-center h-96 text-gray-400">
          <div className="text-center px-6">
            <Package className="w-16 h-16 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-semibold text-gray-500">Your page is empty</p>
            <p className="text-xs text-gray-400 mt-1">Click "Add Block" in the left panel to start building your landing page</p>
          </div>
        </div>
      )}
    </div>
  );
}

function BlockRenderer({ block, theme }) {
  const type = block.type;
  const settings = block.settings || {};
  const s = settings || {};

  switch (type) {
    case 'hero':
      return (
        <div
          className="relative px-6 py-16 text-center"
          style={{
            background: s.backgroundImage
              ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${s.backgroundImage}) center/cover`
              : `linear-gradient(135deg, ${theme.primaryColor}, ${theme.primaryColor}dd)`
          }}
        >
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3 leading-tight">
            {s.headline || 'Your Headline Here'}
          </h1>
          <p className="text-lg text-white/80 mb-6 max-w-md mx-auto">
            {s.subheadline || 'Add a compelling subheadline'}
          </p>
          <button
            className="px-8 py-3.5 rounded-xl text-white font-bold text-lg shadow-xl hover:scale-105 transition-transform"
            style={{ backgroundColor: theme.accentColor }}
          >
            {s.ctaText || 'Order Now'}
          </button>
        </div>
      );

    case 'productGallery':
      return (
        <div className="px-6 py-8">
          <div className={clsx(
            'rounded-xl overflow-hidden bg-gray-100',
            s.layout === 'grid' ? 'grid grid-cols-2 gap-2' : ''
          )}>
            <div className="aspect-square bg-gray-200 flex items-center justify-center">
              <Package className="w-16 h-16 text-gray-400" />
            </div>
            {s.layout === 'grid' && (
              <>
                <div className="aspect-square bg-gray-200 flex items-center justify-center">
                  <Package className="w-12 h-12 text-gray-300" />
                </div>
                <div className="aspect-square bg-gray-200 flex items-center justify-center">
                  <Package className="w-12 h-12 text-gray-300" />
                </div>
                <div className="aspect-square bg-gray-200 flex items-center justify-center">
                  <Package className="w-12 h-12 text-gray-300" />
                </div>
              </>
            )}
          </div>
          {s.showThumbnails && s.layout !== 'grid' && (
            <div className="flex gap-2 mt-3 justify-center">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-14 h-14 rounded-lg bg-gray-200 border-2 border-transparent hover:border-blue-400 cursor-pointer" />
              ))}
            </div>
          )}
        </div>
      );

    case 'benefits':
      return (
        <div className="px-6 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(s.items || []).map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-gray-50">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${theme.primaryColor}20`, color: theme.primaryColor }}>
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">{item.title || 'Benefit'}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{item.description || 'Description'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'variantSelector':
      return (
        <div className="px-6 py-6">
          <h3 className="font-bold text-sm mb-3">Choose your option:</h3>
          <div className="flex flex-wrap gap-2">
            {['Option A', 'Option B', 'Option C'].map((v, i) => (
              <button
                key={i}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors',
                  i === 0
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      );

    case 'codForm':
      return (
        <div className="px-6 py-8">
          <div className="max-w-md mx-auto bg-gray-50 rounded-2xl p-6 border-2 border-dashed border-gray-200">
            <h3 className="font-bold text-lg text-center mb-4" style={{ color: theme.primaryColor }}>
              Order Now — Cash on Delivery
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Full Name', placeholder: 'Ahmed Mohamed' },
                { label: 'Phone Number', placeholder: '05XX XXX XXX' },
                { label: 'Wilaya', placeholder: 'Select wilaya...' },
                { label: 'Commune', placeholder: 'Select commune...' },
                { label: 'Address', placeholder: 'Street, building...' }
              ].map((f, i) => (
                <div key={i}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input
                    type="text"
                    placeholder={f.placeholder}
                    disabled
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-400"
                  />
                </div>
              ))}
              <div className="pt-2">
                <div className="flex items-center justify-between text-sm font-medium mb-1">
                  <span className="text-gray-600">Total:</span>
                  <span className="font-bold" style={{ color: theme.primaryColor }}>0.00 DA</span>
                </div>
              </div>
              <button
                className="w-full py-3 rounded-xl text-white font-bold text-sm shadow-lg"
                style={{ backgroundColor: theme.primaryColor }}
                disabled
              >
                Confirm Order
              </button>
            </div>
          </div>
        </div>
      );

    case 'text':
      return (
        <div className="px-6 py-6" style={{ textAlign: s.alignment || 'center' }}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {s.content || 'Add your text content here...'}
          </p>
        </div>
      );

    case 'image':
      return (
        <div className={clsx('py-4', s.fullWidth ? '' : 'px-6')}>
          {s.url ? (
            <img src={s.url} alt={s.alt || ''} className="w-full rounded-xl object-cover" />
          ) : (
            <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
              <Package className="w-12 h-12 text-gray-300" />
            </div>
          )}
        </div>
      );

    case 'video':
      return (
        <div className="px-6 py-6">
          {s.url ? (
            <div className="aspect-video rounded-xl overflow-hidden">
              <iframe src={s.url} className="w-full h-full" allow="autoplay; fullscreen" />
            </div>
          ) : (
            <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center">
              <Play className="w-12 h-12 text-white/50" />
            </div>
          )}
        </div>
      );

    case 'testimonials':
      return (
        <div className="px-6 py-8 bg-gray-50">
          <h3 className="font-bold text-lg text-center mb-6">What our customers say</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {(s.items || []).map((item, i) => (
              <div key={i} className="bg-white p-4 rounded-xl shadow-sm">
                <div className="flex mb-2">
                  {Array.from({ length: item.rating || 5 }).map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-xs text-gray-600 mb-2 italic">"{item.text || 'Great product!'}"</p>
                <p className="text-xs font-bold text-gray-800">{item.name || 'Customer'}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case 'reviews':
      return (
        <div className="px-6 py-8">
          <h3 className="font-bold text-lg text-center mb-4">Customer Reviews</h3>
          {(s.items || []).length === 0 ? (
            <p className="text-center text-gray-400 text-sm">No reviews configured</p>
          ) : (
            <div className="space-y-3 max-w-lg mx-auto">
              {s.items.map((item, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{item.name}</span>
                    <div className="flex">{Array.from({ length: item.rating || 5 }).map((_, j) => <Star key={j} className="w-3 h-3 text-yellow-400 fill-current" />)}</div>
                  </div>
                  <p className="text-xs text-gray-600">{item.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case 'faq':
      return (
        <div className="px-6 py-8">
          <h3 className="font-bold text-lg text-center mb-6">Frequently Asked Questions</h3>
          <div className="max-w-lg mx-auto space-y-2">
            {(s.items || []).map((item, i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
                  <span className="font-medium text-sm">{item.question || 'Question?'}</span>
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                </div>
                <div className="px-4 pb-4 text-xs text-gray-600">{item.answer || 'Answer here...'}</div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'cta':
      return (
        <div className="px-6 py-8 text-center">
          <button
            className="px-10 py-4 rounded-xl text-white font-bold text-lg shadow-xl hover:scale-105 transition-transform"
            style={{ backgroundColor: s.style === 'accent' ? theme.accentColor : theme.primaryColor }}
          >
            {s.text || 'Order Now'}
          </button>
        </div>
      );

    case 'guarantee':
      return (
        <div className="px-6 py-6">
          <div className="flex items-center gap-4 p-5 rounded-xl border-2 border-green-200 bg-green-50 max-w-md mx-auto">
            <Shield className="w-10 h-10 text-green-600 shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-green-800">{s.title || 'Money Back Guarantee'}</h4>
              <p className="text-xs text-green-700 mt-0.5">{s.description || '30-day return policy'}</p>
            </div>
          </div>
        </div>
      );

    case 'countdown':
      return (
        <div className="px-6 py-6 text-center" style={{ backgroundColor: `${theme.primaryColor}10` }}>
          <p className="text-sm font-medium mb-3" style={{ color: theme.primaryColor }}>{s.label || 'Offer ends in'}</p>
          <div className="flex justify-center gap-3">
            {[{ val: '02', label: 'Days' }, { val: '14', label: 'Hours' }, { val: '37', label: 'Min' }, { val: '52', label: 'Sec' }].map((u, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm px-4 py-3 min-w-[60px]">
                <p className="text-2xl font-bold" style={{ color: theme.primaryColor }}>{u.val}</p>
                <p className="text-[10px] text-gray-500 uppercase">{u.label}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case 'trustBadges':
      return (
        <div className="px-6 py-6">
          <div className="flex flex-wrap justify-center gap-4">
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
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-gray-600" />
                  </div>
                  <span className="text-[10px] text-gray-500 text-center">{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      );

    case 'deliveryInfo':
      return (
        <div className="px-6 py-6">
          <div className="max-w-md mx-auto bg-blue-50 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Truck className="w-6 h-6 text-blue-600" />
              <h4 className="font-bold text-sm text-blue-800">{s.title || 'Delivery Information'}</h4>
            </div>
            <div className="space-y-2 text-xs text-blue-700">
              <p>Coverage: {s.wilayas || 'All 58 wilayas'}</p>
              <p>Estimated delivery: {s.timeframe || '2-5 days'}</p>
              <p>Payment: Cash on Delivery</p>
            </div>
          </div>
        </div>
      );

    case 'stockScarcity':
      return (
        <div className="px-6 py-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 max-w-md mx-auto">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-sm font-medium text-red-700">
              {(s.message || 'Only {count} left!').replace('{count}', s.count || 12)}
            </span>
          </div>
          {s.showBar && (
            <div className="max-w-md mx-auto mt-2">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, ((s.count || 12) / 50) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
      );

    case 'spacer':
      return <div style={{ height: s.height || 40 }} className="bg-transparent" />;

    default:
      return (
        <div className="px-6 py-6 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl m-4">
          Unknown block: {type}
        </div>
      );
  }
}
