"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import EditorSidebar from "./components/EditorSidebar";
import EditorPlayer from "./components/EditorPlayer";
import EditorTimeline from "./components/EditorTimeline";
import PropertiesPanel from "./components/PropertiesPanel";

export interface TimelineClip {
    id: string;
    type: 'video' | 'image' | 'audio';
    url: string;
    thumbnailUrl?: string;
    duration: number;
    startTime: number;
    volume?: number;
    text?: string;
    trimStart?: number;
    trimEnd?: number;
    transition?: 'none' | 'fade' | 'slide';
    originalDuration?: number; // Store original video duration for trim restoration
    layer?: 'base' | 'overlay'; // Legacy: Layer type (kept for backward compatibility)
    layerIndex?: number; // New: Which layer/track this clip is on (0 = bottom, higher = on top)
    smartCut?: boolean; // Enable auto frame matching with previous clip
    // Overlay properties for images placed on top of videos
    overlayX?: number; // X position (0-1920, center = 960)
    overlayY?: number; // Y position (0-1080, center = 540)
    overlayScale?: number; // Scale (1.0 = 100%, 0.5 = 50%, 2.0 = 200%)
    overlayRotation?: number; // Rotation in degrees (0-360)
    overlayWidth?: number; // Custom width (optional, overrides scale)
    overlayHeight?: number; // Custom height (optional, overrides scale)
}

export interface TimelineLayer {
    id: string;
    name: string;
    index: number;
    visible: boolean;
    locked: boolean;
    height?: number; // Custom height for this layer
}

export default function EditorPage() {
    const router = useRouter();
    const supabase = createClient();

    // User State
    const [user, setUser] = useState<any>(null);
    const [credits, setCredits] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    // Assets State
    const [assets, setAssets] = useState<{ videos: any[], images: any[], audio: any[] }>({
        videos: [],
        images: [],
        audio: []
    });
    const [loadingAssets, setLoadingAssets] = useState(false);

    // Editor State
    const [clips, setClips] = useState<TimelineClip[]>([]);
    const [layers, setLayers] = useState<TimelineLayer[]>([
        { id: 'layer-0', name: 'Background', index: 0, visible: true, locked: false },
        { id: 'layer-1', name: 'Layer 1', index: 1, visible: true, locked: false },
        { id: 'layer-2', name: 'Layer 2', index: 2, visible: true, locked: false }
    ]);
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [duration, setDuration] = useState(0);
    const [copiedClip, setCopiedClip] = useState<TimelineClip | null>(null);

    // Render State
    const [isExporting, setIsExporting] = useState(false);
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

    // Smart Cut State
    const [analyzingSmartCut, setAnalyzingSmartCut] = useState<string | null>(null); // clip ID being analyzed
    const [smartCutResult, setSmartCutResult] = useState<{
        clipId: string;
        prevClipId: string;
        video1TrimEnd: number;
        video2TrimStart: number;
        confidence: string;
    } | null>(null);

    // Smart Cut Analysis Function - Bidirectional (trims both clips)
    const handleSmartCutAnalysis = async (clipId: string) => {
        const clip = clips.find(c => c.id === clipId);
        if (!clip || clip.type !== 'video') return;

        // Find the previous video clip on the same layer
        const sameLayerClips = clips
            .filter(c => c.type === 'video' && (c.layerIndex ?? 0) === (clip.layerIndex ?? 0))
            .sort((a, b) => a.startTime - b.startTime);

        const clipIndex = sameLayerClips.findIndex(c => c.id === clipId);
        if (clipIndex <= 0) {
            alert('Smart Cut requires a previous video clip on the same layer');
            handleUpdateClip(clipId, { smartCut: false });
            return;
        }

        const previousClip = sameLayerClips[clipIndex - 1];

        setAnalyzingSmartCut(clipId);
        setSmartCutResult(null);

        try {
            const response = await fetch('/api/video/smart-cut', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    video1Url: previousClip.url,
                    video2Url: clip.url,
                    searchDuration: 3
                })
            });

            const result = await response.json();

            if (result.success && (result.video1TrimEnd || result.video2TrimStart > 0)) {
                // Calculate how much to trim from previous clip
                const prevOriginalDuration = previousClip.originalDuration || previousClip.duration;
                const prevTrimStart = previousClip.trimStart || 0;

                // video1TrimEnd is the point in the original video where we should end
                // We need to calculate the new duration for the clip
                const newPrevDuration = result.video1TrimEnd - prevTrimStart;

                // Update both clips
                setClips(currentClips => {
                    return currentClips.map(c => {
                        if (c.id === previousClip.id) {
                            // Trim end of previous clip
                            return {
                                ...c,
                                duration: Math.max(0.5, newPrevDuration),
                                trimEnd: result.video1TrimEnd
                            };
                        }
                        if (c.id === clipId) {
                            // Trim start of current clip and adjust startTime
                            const newStartTime = previousClip.startTime + newPrevDuration;
                            return {
                                ...c,
                                trimStart: result.video2TrimStart,
                                startTime: newStartTime,
                                smartCut: true
                            };
                        }
                        return c;
                    });
                });

                setSmartCutResult({
                    clipId,
                    prevClipId: previousClip.id,
                    video1TrimEnd: result.video1TrimEnd,
                    video2TrimStart: result.video2TrimStart,
                    confidence: result.confidence
                });

                console.log(`Smart Cut Bidirectional:`);
                console.log(`  Previous clip: End at ${result.video1TrimEnd.toFixed(2)}s`);
                console.log(`  Current clip: Start at ${result.video2TrimStart.toFixed(2)}s`);
                console.log(`  Confidence: ${result.confidence}`);
            } else {
                alert(`Smart Cut: No matching frame found. ${result.confidence === 'NONE' ? 'Try different clips.' : ''}`);
                handleUpdateClip(clipId, { smartCut: false });
            }
        } catch (error) {
            console.error('Smart Cut analysis failed:', error);
            alert('Smart Cut analysis failed. Please try again.');
            handleUpdateClip(clipId, { smartCut: false });
        } finally {
            setAnalyzingSmartCut(null);
        }
    };

    // Playback Loop
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPlaying) {
            interval = setInterval(() => {
                setCurrentTime(prev => {
                    if (prev >= duration) {
                        setIsPlaying(false);
                        return 0;
                    }
                    return prev + 0.1;
                });
            }, 100);
        }
        return () => clearInterval(interval);
    }, [isPlaying, duration]);

    // Calculate total duration whenever clips change
    useEffect(() => {
        const total = clips.reduce((acc, clip) => Math.max(acc, clip.startTime + clip.duration), 0);
        setDuration(Math.max(total, 10)); // Minimum 10s timeline
    }, [clips]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't handle shortcuts if user is typing in an input/textarea
            const isTyping = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

            // Delete selected clip with Delete or Backspace key
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipId && !isTyping) {
                e.preventDefault();
                handleDeleteClip(selectedClipId);
            }

            // Play/Pause with Space key
            if (e.key === ' ' && !isExporting && !isTyping) {
                e.preventDefault();
                setIsPlaying(!isPlaying);
            }

            // Copy clip with Ctrl+C or Cmd+C
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedClipId && !isTyping) {
                e.preventDefault();
                const clip = clips.find(c => c.id === selectedClipId);
                if (clip) {
                    setCopiedClip(clip);
                    console.log('Clip copied:', clip.type);
                }
            }

            // Paste clip with Ctrl+V or Cmd+V
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && copiedClip && !isTyping) {
                e.preventDefault();
                // Find the last clip's end time to place the pasted clip
                const lastClip = clips.reduce((latest, clip) => {
                    const clipEnd = clip.startTime + clip.duration;
                    return clipEnd > latest ? clipEnd : latest;
                }, 0);

                // Create new clip with new ID at the end of timeline
                const newClip: TimelineClip = {
                    ...copiedClip,
                    id: crypto.randomUUID(),
                    startTime: Math.max(lastClip, currentTime) // Place at current time or at the end
                };

                setClips([...clips, newClip]);
                setSelectedClipId(newClip.id);
                console.log('Clip pasted at', newClip.startTime);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedClipId, isPlaying, isExporting, clips, copiedClip, currentTime]);

    // Initial Load
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
    }, []);

    const fetchAssets = async (userId: string) => {
        setLoadingAssets(true);
        const [videos, images, audio] = await Promise.all([
            supabase.from('assets').select('*').eq('user_id', userId).eq('type', 'video').order('created_at', { ascending: false }).limit(50),
            supabase.from('assets').select('*').eq('user_id', userId).eq('type', 'image').order('created_at', { ascending: false }).limit(50),
            supabase.from('assets').select('*').eq('user_id', userId).eq('type', 'audio').order('created_at', { ascending: false }).limit(50)
        ]);

        setAssets({
            videos: videos.data || [],
            images: images.data || [],
            audio: audio.data || []
        });
        setLoadingAssets(false);
    };

    const handleAddAsset = async (asset: any, type: 'video' | 'image' | 'audio', layer?: 'base' | 'overlay', targetLayerIndex?: number, targetTime?: number) => {
        let actualDuration = type === 'image' ? 3 : 5; // Default durations

        // For videos and audio, get the actual duration from the media file
        if (type === 'video' || type === 'audio') {
            try {
                actualDuration = await getMediaDuration(asset.url, type);
                console.log(`Loaded ${type} duration:`, actualDuration.toFixed(2), 'seconds');
            } catch (error) {
                console.error('Failed to get media duration, using default:', error);
                actualDuration = type === 'video' ? 5 : 10; // Fallback to defaults
            }
        }

        // Determine layer: use provided layer or default
        const clipLayer = layer || (type === 'video' ? 'base' : type === 'image' ? 'overlay' : undefined);

        // Assign to layer index - use target if provided, otherwise use defaults
        const clipLayerIndex = targetLayerIndex !== undefined ? targetLayerIndex : (type === 'video' ? 0 : type === 'image' ? 2 : type === 'audio' ? 0 : 0);

        // Calculate startTime - use target if provided, otherwise calculate based on layer
        let startTime = 0;
        if (targetTime !== undefined) {
            // Use the exact drop time if provided, but check for collisions
            startTime = targetTime;

            // Collision detection: prevent overlap on the same layer
            const otherClipsOnLayer = clips.filter(c => (c.layerIndex ?? 0) === clipLayerIndex);
            const clipEndTime = startTime + actualDuration;

            for (const otherClip of otherClipsOnLayer) {
                const otherStart = otherClip.startTime;
                const otherEnd = otherClip.startTime + otherClip.duration;

                // If new clip would overlap with existing clip
                if (startTime < otherEnd && clipEndTime > otherStart) {
                    // Snap to end of other clip
                    startTime = otherEnd;
                }
            }
        } else if (clipLayer === 'base' || type === 'video') {
            // Base clips: place after the last clip on the same layer
            const sameLayerClips = clips.filter(c => (c.layerIndex ?? 0) === clipLayerIndex && c.type !== 'audio');
            const lastClip = sameLayerClips[sameLayerClips.length - 1];
            startTime = lastClip ? lastClip.startTime + lastClip.duration : 0;
        } else if (clipLayer === 'overlay' || type === 'image') {
            // Images: place at current playhead time, but check for collisions
            startTime = currentTime;

            // Collision detection: prevent overlap on the same layer
            const otherClipsOnLayer = clips.filter(c => (c.layerIndex ?? 0) === clipLayerIndex);
            const clipEndTime = startTime + actualDuration;

            for (const otherClip of otherClipsOnLayer) {
                const otherStart = otherClip.startTime;
                const otherEnd = otherClip.startTime + otherClip.duration;

                // If new clip would overlap with existing clip
                if (startTime < otherEnd && clipEndTime > otherStart) {
                    // Snap to end of other clip to avoid overlap
                    startTime = otherEnd;
                }
            }
        }

        const newClip: TimelineClip = {
            id: crypto.randomUUID(),
            type,
            url: asset.url,
            thumbnailUrl: asset.thumbnail_url,
            duration: actualDuration,
            startTime,
            volume: 100,
            originalDuration: actualDuration, // Store original duration for restoration
            layer: clipLayer,
            layerIndex: clipLayerIndex, // New: layer index for multi-track support
            // Default overlay properties for overlay layer images
            ...(clipLayer === 'overlay' && type === 'image' ? {
                overlayX: 960, // Center X (1920/2)
                overlayY: 540, // Center Y (1080/2)
                overlayScale: 0.5, // 50% size by default
                overlayRotation: 0, // No rotation by default
            } : {})
        };

        setClips([...clips, newClip]);
    };

    // Helper function to get actual media duration (video or audio)
    const getMediaDuration = (url: string, type: 'video' | 'audio'): Promise<number> => {
        return new Promise((resolve, reject) => {
            const element = document.createElement(type) as HTMLVideoElement | HTMLAudioElement;
            element.preload = 'metadata';
            element.src = url;

            element.onloadedmetadata = () => {
                const duration = element.duration;
                element.remove();
                if (isNaN(duration) || !isFinite(duration)) {
                    reject(new Error('Invalid duration'));
                } else {
                    resolve(duration);
                }
            };

            element.onerror = () => {
                element.remove();
                reject(new Error(`Failed to load ${type} metadata`));
            };

            // Timeout after 10 seconds
            setTimeout(() => {
                element.remove();
                reject(new Error('Timeout loading media metadata'));
            }, 10000);
        });
    };

    const handleUpdateClip = (id: string, updates: Partial<TimelineClip>) => {
        setClips(clips.map(c => {
            if (c.id !== id) return c;
            return { ...c, ...updates };
        }));
    };

    const handleDeleteClip = (id: string) => {
        const filtered = clips.filter(c => c.id !== id);
        setClips(filtered);
        setSelectedClipId(null);
    };

    // Layer Management Functions
    const handleAddLayer = () => {
        const maxIndex = Math.max(...layers.map(l => l.index), -1);
        const newLayer: TimelineLayer = {
            id: crypto.randomUUID(),
            name: `Layer ${maxIndex + 2}`,
            index: maxIndex + 1,
            visible: true,
            locked: false
        };
        setLayers([...layers, newLayer]);
    };

    const handleRemoveLayer = (layerId: string) => {
        if (layers.length <= 1) return; // Keep at least one layer
        const layerToRemove = layers.find(l => l.id === layerId);
        if (!layerToRemove) return;

        // Remove clips on this layer
        setClips(clips.filter(c => (c.layerIndex ?? 0) !== layerToRemove.index));
        // Remove the layer
        setLayers(layers.filter(l => l.id !== layerId));
    };

    const handleRenameLayer = (layerId: string, newName: string) => {
        setLayers(layers.map(l => l.id === layerId ? { ...l, name: newName } : l));
    };

    const handleToggleLayerVisibility = (layerId: string) => {
        setLayers(layers.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l));
    };

    const handleToggleLayerLock = (layerId: string) => {
        setLayers(layers.map(l => l.id === layerId ? { ...l, locked: !l.locked } : l));
    };

    const handleReorderLayer = (layerId: string, newIndex: number) => {
        const layer = layers.find(l => l.id === layerId);
        if (!layer) return;

        const oldIndex = layer.index;
        // Update all affected layer indices
        const updatedLayers = layers.map(l => {
            if (l.id === layerId) {
                return { ...l, index: newIndex };
            } else if (oldIndex < newIndex && l.index > oldIndex && l.index <= newIndex) {
                return { ...l, index: l.index - 1 };
            } else if (oldIndex > newIndex && l.index >= newIndex && l.index < oldIndex) {
                return { ...l, index: l.index + 1 };
            }
            return l;
        });
        setLayers(updatedLayers);

        // Update clips on the moved layer
        setClips(clips.map(c => c.layerIndex === oldIndex ? { ...c, layerIndex: newIndex } : c));
    };

    const handleSplit = () => {
        if (!selectedClipId) return;
        const clip = clips.find(c => c.id === selectedClipId);
        if (!clip) return;

        // Calculate split point relative to clip start
        const relativeTime = currentTime - clip.startTime;
        if (relativeTime <= 0 || relativeTime >= clip.duration) return;

        const clip1 = { ...clip, duration: relativeTime };
        const clip2 = {
            ...clip,
            id: crypto.randomUUID(),
            duration: clip.duration - relativeTime,
            startTime: currentTime,
            trimStart: (clip.trimStart || 0) + relativeTime
        };

        const index = clips.findIndex(c => c.id === selectedClipId);
        const newClips = [...clips];
        newClips.splice(index, 1, clip1, clip2);

        // Recalculate subsequent start times
        let currentStart = clip2.startTime + clip2.duration;
        for (let i = index + 2; i < newClips.length; i++) {
            newClips[i].startTime = currentStart;
            currentStart += newClips[i].duration;
        }

        setClips(newClips);
        setSelectedClipId(null);
    };

    // Close gaps between clips on the same layer - move clips to eliminate empty spaces
    const handleCloseGaps = () => {
        // Group clips by layer
        const clipsByLayer: Record<number, TimelineClip[]> = {};
        clips.forEach(clip => {
            const layerIndex = clip.layerIndex ?? 0;
            if (!clipsByLayer[layerIndex]) {
                clipsByLayer[layerIndex] = [];
            }
            clipsByLayer[layerIndex].push(clip);
        });

        // Process each layer - sort clips by startTime and close gaps
        const updatedClips: TimelineClip[] = [];
        Object.entries(clipsByLayer).forEach(([layerIndex, layerClips]) => {
            // Sort clips by startTime
            const sortedClips = [...layerClips].sort((a, b) => a.startTime - b.startTime);

            // Recalculate startTimes to close gaps
            let currentStart = 0;
            sortedClips.forEach((clip, index) => {
                if (index === 0) {
                    // First clip on layer can start at 0 or keep its position
                    // For background layer (0), start at 0
                    // For other layers, keep relative positioning but close gaps between clips
                    if (parseInt(layerIndex) === 0) {
                        currentStart = 0;
                    } else {
                        currentStart = clip.startTime;
                    }
                }
                updatedClips.push({
                    ...clip,
                    startTime: currentStart
                });
                currentStart = currentStart + clip.duration;
            });
        });

        setClips(updatedClips);
    };

    const handleExport = async () => {
        if (clips.length === 0) return;
        setIsExporting(true);
        try {
            const response = await fetch("/api/video/compose", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clips, userId: user.id }),
            });
            const data = await response.json();
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
        } catch (e) {
            console.error("Export failed:", e);
            alert("Export failed. Please try again.");
        } finally {
            setIsExporting(false);
        }
    };

    // Determine current clip to display (base layer only - overlays are handled separately)
    const getCurrentClip = (): { type: 'video' | 'image', url: string, startTime: number, trimStart: number } | null => {
        if (finalVideoUrl) return { type: 'video' as const, url: finalVideoUrl, startTime: 0, trimStart: 0 };
        // Find BASE LAYER clip at current time (not overlay clips)
        const activeClip = clips.find(c =>
            (c.type === 'video' || c.type === 'image') &&
            (!c.layer || c.layer === 'base') && // Only base layer clips
            currentTime >= c.startTime &&
            currentTime < (c.startTime + c.duration)
        );
        if (!activeClip) return null;
        if (activeClip.type !== 'video' && activeClip.type !== 'image') return null;
        return {
            type: activeClip.type,
            url: activeClip.url,
            startTime: activeClip.startTime,
            trimStart: activeClip.trimStart || 0
        };
    };

    if (loading) return (
        <div className="h-screen bg-[#09090b] flex items-center justify-center text-white">
            <div className="animate-spin text-4xl">🍌</div>
        </div>
    );

    return (
        <div className="h-screen flex flex-col bg-[#09090b] text-white overflow-hidden font-sans">
            {/* Top Bar */}
            <header className="h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-[#18181b] shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push('/studio')} className="text-gray-400 hover:text-white font-bold text-sm">
                        ← Back
                    </button>
                    <span className="font-bold">Untitled Project</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full text-xs font-bold border border-yellow-500/20">
                        {credits} Credits
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={isExporting || clips.length === 0}
                        className="bg-white text-black px-4 py-1.5 rounded-md text-xs font-bold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExporting ? 'Exporting...' : 'Export'}
                    </button>
                </div>
            </header>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar */}
                <EditorSidebar
                    assets={assets}
                    onAddAsset={handleAddAsset}
                    onUploadComplete={() => {
                        if (user?.id) {
                            fetchAssets(user.id);
                        }
                    }}
                    loading={loadingAssets}
                />

                {/* Center & Bottom Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Player */}
                    <EditorPlayer
                        clip={getCurrentClip()}
                        allClips={clips}
                        overlayClips={clips
                            .filter(c => c.layer === 'overlay' && c.type === 'image')
                            .map(c => ({
                                id: c.id,
                                url: c.url,
                                startTime: c.startTime,
                                duration: c.duration,
                                overlayX: c.overlayX,
                                overlayY: c.overlayY,
                                overlayScale: c.overlayScale,
                                overlayRotation: c.overlayRotation
                            }))
                        }
                        selectedClipId={selectedClipId}
                        onUpdateOverlay={(id, updates) => {
                            handleUpdateClip(id, updates);
                        }}
                        isPlaying={isPlaying}
                        currentTime={currentTime}
                        duration={duration}
                        onPlayPause={() => setIsPlaying(!isPlaying)}
                        onSeek={setCurrentTime}
                    />

                    {/* Timeline */}
                    <EditorTimeline
                        clips={clips}
                        layers={layers}
                        currentTime={currentTime}
                        duration={duration}
                        zoom={zoom}
                        selectedClipId={selectedClipId}
                        onSeek={setCurrentTime}
                        onSelectClip={setSelectedClipId}
                        onZoomChange={setZoom}
                        onSplit={handleSplit}
                        onCloseGaps={handleCloseGaps}
                        onUpdateClip={handleUpdateClip}
                        copiedClip={copiedClip}
                        onAddLayer={handleAddLayer}
                        onRemoveLayer={handleRemoveLayer}
                        onRenameLayer={handleRenameLayer}
                        onToggleLayerVisibility={handleToggleLayerVisibility}
                        onToggleLayerLock={handleToggleLayerLock}
                        onReorderLayer={handleReorderLayer}
                        onDropAsset={(asset, type, layerIndex, time) => {
                            handleAddAsset(asset, type, undefined, layerIndex, time);
                        }}
                    />
                </div>

                {/* Right Sidebar */}
                <PropertiesPanel
                    selectedClip={clips.find(c => c.id === selectedClipId) || null}
                    onUpdateClip={handleUpdateClip}
                    onDeleteClip={handleDeleteClip}
                    onExport={handleExport}
                    isExporting={isExporting}
                    credits={credits}
                    cost={Math.max(5, Math.ceil(duration / 60) * 5)}
                    onAnalyzeSmartCut={handleSmartCutAnalysis}
                    analyzingSmartCut={analyzingSmartCut}
                    smartCutResult={smartCutResult}
                />
            </div>

            {/* Export Success Modal */}
            {finalVideoUrl && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-[#18181b] border border-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-white font-bold text-2xl">Export Complete! 🎉</h2>
                                <button
                                    onClick={() => setFinalVideoUrl(null)}
                                    className="text-gray-400 hover:text-white text-2xl font-bold"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                                    <video
                                        src={finalVideoUrl}
                                        controls
                                        autoPlay
                                        className="w-full h-full"
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <a
                                        href={finalVideoUrl}
                                        download="banana-edited-video.mp4"
                                        className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-3 rounded-lg font-black text-center transition-all"
                                    >
                                        Download Video 💾
                                    </a>
                                    <button
                                        onClick={() => setFinalVideoUrl(null)}
                                        className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition-colors"
                                    >
                                        New Edit
                                    </button>
                                </div>

                                <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-400">
                                    <p className="mb-1">
                                        <span className="font-bold text-white">Total Duration:</span> {duration.toFixed(1)}s
                                    </p>
                                    <p>
                                        <span className="font-bold text-white">Clips Used:</span> {clips.length}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
