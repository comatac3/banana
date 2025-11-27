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
  metadata?: {
    source?: string;
    taskId?: string;
    canExtend?: boolean;
  };
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

  // Extend video state
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendPrompt, setExtendPrompt] = useState("");
  const [isExtending, setIsExtending] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);

  // Edit taskId state
  const [showEditTaskId, setShowEditTaskId] = useState(false);
  const [editTaskIdValue, setEditTaskIdValue] = useState("");
  const [isSavingTaskId, setIsSavingTaskId] = useState(false);

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

  const handleSaveTaskId = async () => {
    if (!selectedAsset || !editTaskIdValue.trim()) return;

    setIsSavingTaskId(true);
    try {
      const response = await fetch('/api/assets/update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedAsset.id,
          taskId: editTaskIdValue.trim(),
          canExtend: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Update local state
      setAssets(assets.map(a =>
        a.id === selectedAsset.id
          ? { ...a, metadata: { ...a.metadata, taskId: editTaskIdValue.trim(), canExtend: true } }
          : a
      ));
      setSelectedAsset({
        ...selectedAsset,
        metadata: { ...selectedAsset.metadata, taskId: editTaskIdValue.trim(), canExtend: true }
      });
      setShowEditTaskId(false);
      setEditTaskIdValue("");
    } catch (error: any) {
      alert(error.message || 'Failed to save taskId');
    } finally {
      setIsSavingTaskId(false);
    }
  };

  const canExtendVideo = (asset: Asset) => {
    // Check if video can be extended:
    // 1. Must be a video
    // 2. Must have taskId in metadata
    // 3. Either canExtend is true OR model is a veo3 variant (for backwards compatibility)
    if (asset.type !== 'video' || !asset.metadata?.taskId) return false;

    // If canExtend is explicitly set, use it
    if (asset.metadata?.canExtend !== undefined) {
      return asset.metadata.canExtend === true;
    }

    // Backwards compatibility: allow extending for veo3 model variants
    const veo3Models = ['veo3', 'veo3_fast', 'veo3_transition', 'veo3_extend'];
    return veo3Models.includes(asset.model || '');
  };

  const handleExtendVideo = async () => {
    if (!selectedAsset || !selectedAsset.metadata?.taskId || !extendPrompt.trim()) return;

    setIsExtending(true);
    setExtendError(null);

    try {
      // Start the extend request
      const response = await fetch('/api/video/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: selectedAsset.metadata.taskId,
          prompt: extendPrompt.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extend video');
      }

      // Poll for the extended video
      if (data.operationId) {
        await pollForExtendedVideo(data.operationId);
      }
    } catch (error: any) {
      console.error('Error extending video:', error);
      setExtendError(error.message || 'Failed to extend video');
    } finally {
      setIsExtending(false);
    }
  };

  const pollForExtendedVideo = async (operationId: string) => {
    const maxAttempts = 120; // 10 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        const response = await fetch(`/api/video/status?operationId=${encodeURIComponent(operationId)}&model=veo3_extend`);
        const data = await response.json();

        if (data.status === 'completed' && data.videoUrl) {
          // Refresh assets to show the new extended video
          await fetchAssets();
          // Refresh credits
          const { data: profile } = await supabase
            .from('profiles')
            .select('credits')
            .eq('id', user.id)
            .single();
          setCredits(profile?.credits ?? 0);
          // Close modals
          setShowExtendModal(false);
          setSelectedAsset(null);
          setExtendPrompt('');
          return;
        } else if (data.status === 'failed') {
          throw new Error(data.error || 'Video extension failed');
        }
      } catch (error: any) {
        console.error('Polling error:', error);
        throw error;
      }

      attempts++;
    }

    throw new Error('Video extension timed out. Please check your assets later.');
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
                <div className="aspect-square bg-gray-900 relative overflow-hidden">
                  {asset.type === 'image' ? (
                    <img
                      src={asset.thumbnail_url || asset.url}
                      alt="Asset"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                      <video
                        src={asset.url}
                        className="w-full h-full object-contain"
                        muted
                        playsInline
                        loop
                        onMouseEnter={(e) => {
                          e.currentTarget.currentTime = 0;
                          e.currentTarget.play().catch(() => {});
                        }}
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

                {/* TaskId for videos */}
                {selectedAsset.type === 'video' && (
                  <div className="pt-2 border-t border-gray-200">
                    {showEditTaskId ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editTaskIdValue}
                          onChange={(e) => setEditTaskIdValue(e.target.value)}
                          placeholder="Enter Task ID"
                          className="flex-1 px-3 py-1 border-2 border-gray-300 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
                        />
                        <button
                          onClick={handleSaveTaskId}
                          disabled={isSavingTaskId || !editTaskIdValue.trim()}
                          className="px-3 py-1 bg-purple-500 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                        >
                          {isSavingTaskId ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setShowEditTaskId(false); setEditTaskIdValue(""); }}
                          className="px-3 py-1 bg-gray-200 rounded-lg text-sm font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-bold">Task ID:</span>
                        {selectedAsset.metadata?.taskId ? (
                          <>
                            <span className="text-gray-600 font-mono text-xs truncate max-w-[200px]">
                              {selectedAsset.metadata.taskId}
                            </span>
                            <button
                              onClick={() => {
                                setEditTaskIdValue(selectedAsset.metadata?.taskId || "");
                                setShowEditTaskId(true);
                              }}
                              className="text-purple-500 hover:text-purple-700 text-xs"
                            >
                              ✏️ Edit
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setShowEditTaskId(true)}
                            className="text-purple-500 hover:text-purple-700 text-xs font-bold"
                          >
                            + Add Task ID (for Extend)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t-2 border-black flex gap-3 flex-wrap">
              <a
                href={selectedAsset.url}
                download={`banana-${selectedAsset.type}-${selectedAsset.id}`}
                className="flex-1 btn-pop bg-pop-green text-white py-3 rounded-xl font-black text-center min-w-[120px]"
              >
                Download 💾
              </a>
              {canExtendVideo(selectedAsset) && (
                <button
                  onClick={() => setShowExtendModal(true)}
                  className="px-6 py-3 bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-xl font-black border-2 border-purple-300 transition-all"
                >
                  Extend Video 🎬
                </button>
              )}
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

      {/* Extend Video Modal */}
      {showExtendModal && selectedAsset && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => !isExtending && setShowExtendModal(false)}
        >
          <div
            className="bg-white rounded-2xl border-4 border-black max-w-xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b-2 border-black flex justify-between items-center bg-purple-50">
              <h3 className="font-black text-lg">🎬 Extend Video</h3>
              <button
                onClick={() => !isExtending && setShowExtendModal(false)}
                disabled={isExtending}
                className="text-2xl hover:scale-110 transition-transform disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              <div className="bg-gray-100 rounded-lg p-3 text-sm">
                <p className="font-bold mb-1">How it works:</p>
                <ul className="text-gray-600 space-y-1 list-disc list-inside">
                  <li>Extends your video with new AI-generated content</li>
                  <li>Describe what should happen next in the video</li>
                  <li>Cost: 10 credits</li>
                </ul>
              </div>

              <div>
                <label className="block font-bold mb-2">Describe the extension:</label>
                <textarea
                  value={extendPrompt}
                  onChange={(e) => setExtendPrompt(e.target.value)}
                  placeholder="The camera continues to pan right, revealing a beautiful sunset over the ocean..."
                  className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none resize-none"
                  rows={4}
                  disabled={isExtending}
                />
              </div>

              {extendError && (
                <div className="bg-red-100 border-2 border-red-300 rounded-lg p-3 text-red-600 text-sm">
                  {extendError}
                </div>
              )}

              {isExtending && (
                <div className="bg-purple-100 border-2 border-purple-300 rounded-lg p-4 text-center">
                  <div className="text-3xl animate-bounce mb-2">🎬</div>
                  <p className="font-bold text-purple-700">Extending video...</p>
                  <p className="text-sm text-purple-600">This may take a few minutes</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t-2 border-black flex gap-3">
              <button
                onClick={() => !isExtending && setShowExtendModal(false)}
                disabled={isExtending}
                className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-black border-2 border-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExtendVideo}
                disabled={isExtending || !extendPrompt.trim() || (credits ?? 0) < 10}
                className="flex-1 btn-pop bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-xl font-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExtending ? 'Extending...' : 'Extend (10 🍌)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
