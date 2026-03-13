import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Eye, AlertCircle } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch';
import Storefront from './Storefront';

/**
 * Authenticated preview wrapper for landing pages.
 * Fetches page data via the authenticated preview API (works for draft + published pages)
 * and renders the full Storefront experience.
 */
export default function StorefrontPreview() {
  const { channelId, pageId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/api/sales-channels/${channelId}/pages/${pageId}/preview`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to load preview');
        }
        const json = await res.json();
        setData(json.data ?? json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [channelId, pageId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-sm text-gray-500">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3 max-w-md">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Preview banner */}
      <div className="sticky top-0 z-[100] bg-amber-500 text-amber-950 text-center py-1.5 px-4 text-xs font-bold flex items-center justify-center gap-2 shadow-md">
        <Eye className="w-3.5 h-3.5" />
        PREVIEW MODE — {data?.page?.status === 'draft' ? 'This page is not published yet' : 'Viewing published page'}
      </div>
      <Storefront previewData={data} />
    </div>
  );
}
