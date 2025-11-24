"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

interface TimelineClip {
    id: string;
    type: 'video' | 'image' | 'audio';
    url: string;
    thumbnailUrl?: string;
    duration: number; // seconds
    startTime: number; // position in timeline
}

export default function EditorPage() {
    const router = useRouter();
    const supabase = createClient();
    const { t } = useLanguage();

    const [user, setUser] = useState<any>(null);
    const [credits, setCredits] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // Assets library
    const [videoAssets, setVideoAssets] = useState<any[]>([]);
    const [imageAssets, setImageAssets] = useState<any[]>([]);
    const [loadingAssets, setLoadingAssets] = useState(false);
    const [showAssetLibrary, setShowAssetLibrary] = useState(true);
    const [assetType, setAssetType] = useState<'video' | 'image'>('video');

    // Timeline
    const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([]);
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

    // Rendering
    const [isRendering, setIsRendering] = useState(false);
    const [renderProgress, setRenderProgress] = useState(0);
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/");
                return;
            }
            setUser(user);

            const { data: profile } = await supabase
                .from('profiles')
                .select('credits')
                .eq('id', user.id)
                .single();
            setCredits(profile?.credits ?? 0);

            await fetchAssets(user.id);
            setLoading(false);
        };

        init();
    }, [router, supabase]);

    const fetchAssets = async (userId: string) => {
        setLoadingAssets(true);
        try {
            // Fetch videos
            const { data: videos } = await supabase
                .from('assets')
                .select('*')
                .eq('user_id', userId)
                .eq('type', 'video')
                .order('created_at', { ascending: false })
                .limit(50);

            // Fetch images
            const { data: images } = await supabase
                .from('assets')
                .select('*')
                .eq('user_id', userId)
                .eq('type', 'image')
                .order('created_at', { ascending: false })
                .limit(50);

            setVideoAssets(videos || []);
            setImageAssets(images || []);
        } catch (e) {
            console.error("Error fetching assets:", e);
        }
        setLoadingAssets(false);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        window.location.href = "/";
    };

    const addToTimeline = (asset: any, type: 'video' | 'image') => {
        const lastClip = timelineClips[timelineClips.length - 1];
        const startTime = lastClip ? lastClip.startTime + lastClip.duration : 0;

        const newClip: TimelineClip = {
            id: `clip-${Date.now()}-${Math.random()}`,
            type,
            url: asset.url,
            thumbnailUrl: asset.thumbnail_url || asset.url,
            duration: type === 'image' ? 3 : 8, // Default: 3s for images, 8s for videos
            startTime,
        };

        setTimelineClips([...timelineClips, newClip]);
    };

    const removeClip = (clipId: string) => {
        const updatedClips = timelineClips.filter(c => c.id !== clipId);
        // Recalculate start times
        let currentTime = 0;
        const recalculated = updatedClips.map(clip => {
            const updated = { ...clip, startTime: currentTime };
            currentTime += clip.duration;
            return updated;
        });
        setTimelineClips(recalculated);
        setSelectedClipId(null);
    };

    const updateClipDuration = (clipId: string, newDuration: number) => {
        const clipIndex = timelineClips.findIndex(c => c.id === clipId);
        if (clipIndex === -1) return;

        const updated = [...timelineClips];
        updated[clipIndex].duration = newDuration;

        // Recalculate start times for subsequent clips
        let currentTime = 0;
        const recalculated = updated.map(clip => {
            const updatedClip = { ...clip, startTime: currentTime };
            currentTime += clip.duration;
            return updatedClip;
        });

        setTimelineClips(recalculated);
    };

    const getTotalDuration = () => {
        return timelineClips.reduce((sum, clip) => sum + clip.duration, 0);
    };

    const getRenderCost = () => {
        const totalDuration = getTotalDuration();
        const segments = Math.ceil(totalDuration / 60); // 1 credit per minute
        return Math.max(5, segments * 5); // Minimum 5 credits
    };

    const handleRender = async () => {
        if (timelineClips.length === 0) {
            alert("Please add clips to timeline first!");
            return;
        }

        const cost = getRenderCost();
        if (!credits || credits < cost) {
            alert("Insufficient credits!");
            return;
        }

        setIsRendering(true);
        setRenderProgress(0);
        setErrorMessage(null);

        try {
            // Call video composition API
            const response = await fetch("/api/video/compose", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clips: timelineClips,
                    userId: user.id,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to render video");
            }

            if (data.videoUrl) {
                setFinalVideoUrl(data.videoUrl);
                // Refresh credits
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('credits')
                    .eq('id', user.id)
                    .single();
                setCredits(profile?.credits ?? 0);
            }
        } catch (error: any) {
            console.error("Render error:", error);
            setErrorMessage(error.message || "Failed to render video");
        } finally {
            setIsRendering(false);
        }
    };

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-white">
            <div className="text-center">
                <div className="text-6xl animate-bounce mb-4">🍌</div>
                <div className="text-xl font-black">LOADING EDITOR...</div>
            </div>
        </div>
    );

    if (!user) return null;

    const selectedClip = timelineClips.find(c => c.id === selectedClipId);

    return (
        <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b-4 border-black p-4 flex justify-between items-center shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push("/studio")}
                        className="font-black hover:underline flex items-center gap-2"
                    >
                        ← Back
                    </button>
                    <h1 className="text-2xl font-black hidden sm:block">VIDEO EDITOR ✂️</h1>
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

            <div className="flex-1 flex overflow-hidden">
                {/* Asset Library Sidebar */}
                <div className={`bg-white border-r-2 border-black overflow-y-auto transition-all ${showAssetLibrary ? 'w-64' : 'w-0'}`}>
                    {showAssetLibrary && (
                        <div className="p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="font-black text-lg">Assets</h2>
                                <button
                                    onClick={() => setShowAssetLibrary(false)}
                                    className="text-gray-500 hover:text-black"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Asset Type Tabs */}
                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={() => setAssetType('video')}
                                    className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm ${
                                        assetType === 'video'
                                            ? 'bg-black text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    🎥 Videos
                                </button>
                                <button
                                    onClick={() => setAssetType('image')}
                                    className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm ${
                                        assetType === 'image'
                                            ? 'bg-black text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    🖼️ Images
                                </button>
                            </div>

                            {/* Asset List */}
                            <div className="space-y-2">
                                {loadingAssets ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <div className="animate-spin text-2xl mb-2">🍌</div>
                                        <p className="text-xs">Loading...</p>
                                    </div>
                                ) : assetType === 'video' ? (
                                    videoAssets.length === 0 ? (
                                        <p className="text-center text-gray-500 text-sm py-8">No videos yet</p>
                                    ) : (
                                        videoAssets.map((asset) => (
                                            <button
                                                key={asset.id}
                                                onClick={() => addToTimeline(asset, 'video')}
                                                className="w-full text-left p-2 rounded-lg border-2 border-gray-200 hover:border-black hover:bg-gray-50 transition-all group"
                                            >
                                                <div className="aspect-video bg-gray-100 rounded overflow-hidden mb-1">
                                                    <video src={asset.url} className="w-full h-full object-cover" />
                                                </div>
                                                <p className="text-xs font-bold truncate">{asset.prompt || 'Video'}</p>
                                                <p className="text-xs text-gray-500">{asset.model}</p>
                                            </button>
                                        ))
                                    )
                                ) : (
                                    imageAssets.length === 0 ? (
                                        <p className="text-center text-gray-500 text-sm py-8">No images yet</p>
                                    ) : (
                                        imageAssets.map((asset) => (
                                            <button
                                                key={asset.id}
                                                onClick={() => addToTimeline(asset, 'image')}
                                                className="w-full text-left p-2 rounded-lg border-2 border-gray-200 hover:border-black hover:bg-gray-50 transition-all"
                                            >
                                                <div className="aspect-square bg-gray-100 rounded overflow-hidden mb-1">
                                                    <img src={asset.thumbnail_url || asset.url} alt="" className="w-full h-full object-cover" />
                                                </div>
                                                <p className="text-xs font-bold truncate">{asset.prompt || 'Image'}</p>
                                            </button>
                                        ))
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Editor Area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Preview Area */}
                    <div className="flex-1 bg-black flex items-center justify-center p-4">
                        {finalVideoUrl ? (
                            <div className="max-w-4xl w-full">
                                <video
                                    src={finalVideoUrl}
                                    controls
                                    autoPlay
                                    className="w-full rounded-lg"
                                />
                                <div className="flex gap-4 mt-4">
                                    <a
                                        href={finalVideoUrl}
                                        download="edited-video.mp4"
                                        className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-black text-center"
                                    >
                                        Download Video 💾
                                    </a>
                                    <button
                                        onClick={() => setFinalVideoUrl(null)}
                                        className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold"
                                    >
                                        New Edit
                                    </button>
                                </div>
                            </div>
                        ) : errorMessage ? (
                            <div className="text-center">
                                <div className="text-6xl mb-4">⚠️</div>
                                <p className="text-red-400 font-bold mb-2">{errorMessage}</p>
                                <button
                                    onClick={() => setErrorMessage(null)}
                                    className="text-gray-500 hover:text-white underline text-sm"
                                >
                                    Dismiss
                                </button>
                            </div>
                        ) : isRendering ? (
                            <div className="text-center">
                                <div className="text-6xl animate-bounce mb-4">⚙️</div>
                                <p className="text-white font-bold text-xl mb-2">Rendering your video...</p>
                                <div className="w-64 bg-gray-700 rounded-full h-3 overflow-hidden mx-auto">
                                    <div
                                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all"
                                        style={{ width: `${renderProgress}%` }}
                                    />
                                </div>
                                <p className="text-gray-400 text-sm mt-2">This may take a few minutes</p>
                            </div>
                        ) : (
                            <div className="text-center text-gray-500">
                                <div className="text-6xl mb-4 opacity-20">✂️</div>
                                <p className="text-xl font-bold opacity-50">Add clips to timeline to preview</p>
                            </div>
                        )}
                    </div>

                    {/* Timeline Area */}
                    <div className="bg-gray-900 border-t-4 border-black p-4 h-64 overflow-x-auto">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-4">
                                {!showAssetLibrary && (
                                    <button
                                        onClick={() => setShowAssetLibrary(true)}
                                        className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm font-bold"
                                    >
                                        📁 Assets
                                    </button>
                                )}
                                <div className="text-white text-sm font-bold">
                                    Timeline: {timelineClips.length} clips • {getTotalDuration()}s
                                </div>
                            </div>
                            <button
                                onClick={handleRender}
                                disabled={timelineClips.length === 0 || isRendering}
                                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-2 rounded-lg font-black disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Render Video ({getRenderCost()} 🍌)
                            </button>
                        </div>

                        {/* Timeline Clips */}
                        <div className="flex gap-2 items-start min-w-max pb-4">
                            {timelineClips.length === 0 ? (
                                <div className="w-full text-center py-8 text-gray-500">
                                    <p className="text-sm">Drag assets here to start editing</p>
                                </div>
                            ) : (
                                timelineClips.map((clip) => (
                                    <div
                                        key={clip.id}
                                        onClick={() => setSelectedClipId(clip.id)}
                                        className={`relative group cursor-pointer ${
                                            selectedClipId === clip.id ? 'ring-2 ring-purple-500' : ''
                                        }`}
                                        style={{ width: `${clip.duration * 20}px`, minWidth: '80px' }}
                                    >
                                        <div className="bg-gray-700 rounded-lg overflow-hidden h-24 border-2 border-gray-600 hover:border-purple-500 transition-all">
                                            {clip.type === 'video' ? (
                                                <video src={clip.url} className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={clip.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                        <div className="absolute top-1 left-1 bg-black text-white text-xs px-1 rounded font-bold">
                                            {clip.type === 'video' ? '🎥' : '🖼️'}
                                        </div>
                                        <div className="absolute bottom-1 left-1 bg-black text-white text-xs px-1 rounded font-bold">
                                            {clip.duration}s
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeClip(clip.id);
                                            }}
                                            className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Clip Properties Panel */}
                        {selectedClip && (
                            <div className="mt-2 bg-gray-800 rounded-lg p-3">
                                <div className="flex justify-between items-center text-white">
                                    <span className="font-bold text-sm">
                                        {selectedClip.type === 'video' ? '🎥 Video' : '🖼️ Image'} Clip
                                    </span>
                                    <button
                                        onClick={() => setSelectedClipId(null)}
                                        className="text-gray-400 hover:text-white"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="mt-2">
                                    <label className="text-white text-xs font-bold block mb-1">
                                        Duration: {selectedClip.duration}s
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max={selectedClip.type === 'image' ? 10 : 30}
                                        value={selectedClip.duration}
                                        onChange={(e) => updateClipDuration(selectedClip.id, Number(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
