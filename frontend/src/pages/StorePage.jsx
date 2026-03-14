import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Eye, Loader2, Store, ArrowRight } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Public store homepage — lists all published landing pages for a channel.
 * Route: /s/:channelSlug
 */
export default function StorePage() {
  const { channelSlug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/s/${channelSlug}`, { signal: ac.signal });
        if (!res.ok) throw new Error('Store not found');
        const json = await res.json();
        setData(json.data ?? json);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [channelSlug]);

  // Set document title
  useEffect(() => {
    if (data?.channel?.name) {
      document.title = data.channel.name;
    }
    return () => { document.title = 'Store'; };
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-6">
          <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-700 mb-2">Store not found</h1>
          <p className="text-sm text-gray-500">This store doesn't exist or is no longer available.</p>
        </div>
      </div>
    );
  }

  const { channel, pages } = data;
  const primaryColor = channel.branding?.primaryColor || '#2563eb';
  const accentColor = channel.branding?.accentColor || '#f59e0b';

  // If only one page, redirect directly to it
  if (pages.length === 1) {
    window.location.replace(`/s/${channelSlug}/${pages[0].slug}`);
    return null;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Store Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center gap-4">
            {channel.branding?.logo ? (
              <img src={channel.branding.logo} alt={channel.name} className="h-12 w-auto object-contain" />
            ) : (
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-md"
                style={{ backgroundColor: primaryColor }}
              >
                {channel.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{channel.name}</h1>
              {channel.description && (
                <p className="text-sm text-gray-500 mt-0.5 max-w-lg">{channel.description}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Products Grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {pages.length === 0 ? (
          <div className="text-center py-20">
            <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-600">No products available</h2>
            <p className="text-sm text-gray-400 mt-1">Check back later for new products.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-800">
                {pages.length} {pages.length === 1 ? 'Product' : 'Products'}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {pages.map(page => (
                <Link
                  key={page._id}
                  to={`/s/${channelSlug}/${page.slug}`}
                  className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  {/* Product Image */}
                  <div className="aspect-square bg-gray-100 overflow-hidden relative">
                    {page.product?.image ? (
                      <img
                        src={page.product.image.startsWith('/') ? `${API_BASE}${page.product.image}` : page.product.image}
                        alt={page.product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingCart className="w-16 h-16 text-gray-300" />
                      </div>
                    )}
                    {/* Promo price badge */}
                    {page.product?.promotionalPrice != null && (
                      <div
                        className="absolute top-3 start-3 px-3 py-1 rounded-full text-white text-xs font-bold shadow-lg"
                        style={{ backgroundColor: accentColor }}
                      >
                        {page.product.promotionalPrice.toLocaleString()} DA
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-2" style={{ '--tw-text-opacity': 1 }}>
                      {page.product?.name || page.title}
                    </h3>
                    {page.product?.description && (
                      <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{page.product.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" /> {page.stats?.views || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <ShoppingCart className="w-3.5 h-3.5" /> {page.stats?.orders || 0}
                        </span>
                      </div>
                      <span
                        className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full text-white transition-transform group-hover:scale-105"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Order <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} {channel.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
