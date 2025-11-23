"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

interface Asset {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail_url: string | null;
  prompt: string | null;
  style: string | null;
  model: string | null;
  created_at: string;
}

export default function AssetPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      // Check auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }
      setUser(user);

      // Fetch credits
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single();
      setCredits(profile?.credits ?? 0);

      // Fetch assets
      await fetchAssets();
      setLoading(false);
    };

    init();
  }, [router, supabase]);

  const fetchAssets = async () => {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching assets:", error);
      return;
    }

    setAssets(data || []);
  };

  const handleDelete = async (asset: Asset) => {
    if (!confirm("Are you sure you want to delete this asset?")) return;

    setDeleting(asset.id);
    try {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', asset.id);

      if (error) throw error;

      setAssets(assets.filter(a => a.id !== asset.id));
      if (selectedAsset?.id === asset.id) {
        setSelectedAsset(null);
      }
    } catch (e) {
      console.error("Error deleting asset:", e);
      alert("Failed to delete asset");
    } finally {
      setDeleting(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const filteredAssets = assets.filter(asset =>
    filter === 'all' || asset.type === filter
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="text-6xl animate-bounce mb-4">🍌</div>
        <div className="text-xl font-black">LOADING ASSETS...</div>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b-4 border-black p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="font-black hover:underline flex items-center gap-2"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-black hidden sm:block">MY ASSETS 📁</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-full border-2 border-black font-bold">
            <span>🍌 {credits} Credits</span>
          </div>
          <LanguageToggle />
          <button
            onClick={handleSignOut}
            className="bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 px-3 py-1 rounded-md text-xs font-black border-2 border-transparent hover:border-red-200 transition-all uppercase tracking-wider"
          >
            Out
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {(['all', 'image', 'video'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-lg font-bold border-2 transition-all ${
                filter === type
                  ? 'bg-banana border-black shadow-hard'
                  : 'bg-white border-gray-300 hover:border-black'
              }`}
            >
              {type === 'all' ? '📁 All' : type === 'image' ? '🖼️ Images' : '🎥 Videos'}
              <span className="ml-2 text-sm opacity-70">
                ({type === 'all'
                  ? assets.length
                  : assets.filter(a => a.type === type).length})
              </span>
            </button>
          ))}
        </div>

        {/* Assets Grid */}
        {filteredAssets.length === 0 ? (
          <div className="bg-white rounded-xl border-2 border-black p-12 text-center">
            <div className="text-6xl mb-4 opacity-30">
              {filter === 'image' ? '🖼️' : filter === 'video' ? '🎥' : '📁'}
            </div>
            <p className="text-xl font-bold text-gray-400">
              No {filter === 'all' ? 'assets' : filter + 's'} yet
            </p>
            <p className="text-gray-400 mt-2">
              Generate some images or videos to see them here!
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 btn-pop bg-pop-blue text-white px-6 py-3 rounded-xl font-black"
            >
              Start Creating
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className={`bg-white rounded-xl border-2 overflow-hidden cursor-pointer transition-all hover:shadow-hard hover:-translate-y-1 ${
                  selectedAsset?.id === asset.id ? 'border-banana shadow-hard' : 'border-gray-200'
                }`}
                onClick={() => setSelectedAsset(asset)}
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  {asset.type === 'image' ? (
                    <img
                      src={asset.thumbnail_url || asset.url}
                      alt="Asset"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                      <video
                        src={asset.url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/50 rounded-full p-3">
                          <span className="text-2xl">▶️</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Type badge */}
                  <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-bold text-white ${
                    asset.type === 'image' ? 'bg-blue-500' : 'bg-purple-500'
                  }`}>
                    {asset.type === 'image' ? '🖼️' : '🎥'}
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-xs text-gray-500 truncate">
                    {asset.model || 'Unknown model'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(asset.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Asset Preview Modal */}
      {selectedAsset && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedAsset(null)}
        >
          <div
            className="bg-white rounded-2xl border-4 border-black max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b-2 border-black flex justify-between items-center">
              <h3 className="font-black text-lg">
                {selectedAsset.type === 'image' ? '🖼️ Image' : '🎥 Video'} Preview
              </h3>
              <button
                onClick={() => setSelectedAsset(null)}
                className="text-2xl hover:scale-110 transition-transform"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-black rounded-xl overflow-hidden flex items-center justify-center">
                {selectedAsset.type === 'image' ? (
                  <img
                    src={selectedAsset.url}
                    alt="Preview"
                    className="max-w-full max-h-[50vh] object-contain"
                  />
                ) : (
                  <video
                    src={selectedAsset.url}
                    controls
                    autoPlay
                    className="max-w-full max-h-[50vh]"
                  />
                )}
              </div>

              {/* Details */}
              <div className="mt-4 space-y-2 text-sm">
                {selectedAsset.model && (
                  <p><span className="font-bold">Model:</span> {selectedAsset.model}</p>
                )}
                {selectedAsset.prompt && (
                  <p><span className="font-bold">Prompt:</span> {selectedAsset.prompt}</p>
                )}
                <p><span className="font-bold">Created:</span> {formatDate(selectedAsset.created_at)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t-2 border-black flex gap-3">
              <a
                href={selectedAsset.url}
                download={`banana-${selectedAsset.type}-${selectedAsset.id}`}
                className="flex-1 btn-pop bg-pop-green text-white py-3 rounded-xl font-black text-center"
              >
                Download 💾
              </a>
              <button
                onClick={() => handleDelete(selectedAsset)}
                disabled={deleting === selectedAsset.id}
                className="px-6 py-3 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl font-black border-2 border-red-300 disabled:opacity-50"
              >
                {deleting === selectedAsset.id ? '...' : '🗑️ Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
