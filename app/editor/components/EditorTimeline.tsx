import { useRef, useEffect, useState } from 'react';
import { ZoomIn, ZoomOut, Scissors, SplitSquareHorizontal, Eye, EyeOff, Lock, LockOpen, Plus, X, Edit2, AlignHorizontalJustifyStart } from 'lucide-react';
import VideoFramePreview from './VideoFramePreview';
import React from 'react';

interface TimelineClip {
    id: string;
    type: 'video' | 'image' | 'audio';
    url: string;
    thumbnailUrl?: string;
    duration: number;
    startTime: number;
    text?: string;
    volume?: number;
    trimStart?: number;
    trimEnd?: number;
    transition?: 'none' | 'fade' | 'slide';
    originalDuration?: number;
    layer?: 'base' | 'overlay';
    layerIndex?: number;
    smartCut?: boolean;
    overlayX?: number;
    overlayY?: number;
    overlayScale?: number;
    overlayRotation?: number;
    overlayWidth?: number;
    overlayHeight?: number;
}

interface TimelineLayer {
    id: string;
    name: string;
    index: number;
    visible: boolean;
    locked: boolean;
    height?: number;
}

interface EditorTimelineProps {
    clips: TimelineClip[];
    layers: TimelineLayer[];
    currentTime: number;
    duration: number;
    zoom: number;
    selectedClipId: string | null;
    onSeek: (time: number) => void;
    onSelectClip: (id: string | null) => void;
    onZoomChange: (zoom: number) => void;
    onSplit: () => void;
    onCloseGaps: () => void;
    onUpdateClip: (id: string, updates: Partial<TimelineClip>) => void;
    copiedClip?: TimelineClip | null;
    onAddLayer: () => void;
    onRemoveLayer: (layerId: string) => void;
    onRenameLayer: (layerId: string, newName: string) => void;
    onToggleLayerVisibility: (layerId: string) => void;
    onToggleLayerLock: (layerId: string) => void;
    onReorderLayer: (layerId: string, newIndex: number) => void;
    onDropAsset?: (asset: any, type: 'video' | 'image' | 'audio', layerIndex: number, time: number) => void;
}

export default function EditorTimeline({
    clips,
    layers,
    currentTime,
    duration,
    zoom,
    selectedClipId,
    onSeek,
    onSelectClip,
    onZoomChange,
    onSplit,
    onCloseGaps,
    onUpdateClip,
    copiedClip,
    onAddLayer,
    onRemoveLayer,
    onRenameLayer,
    onToggleLayerVisibility,
    onToggleLayerLock,
    onReorderLayer,
    onDropAsset
}: EditorTimelineProps) {
    const timelineRef = useRef<HTMLDivElement>(null);
    const PIXELS_PER_SECOND = 20 * zoom;
    const [hoverPreview, setHoverPreview] = React.useState<{ clip: TimelineClip; time: number; x: number; y: number } | null>(null);
    const [trimming, setTrimming] = useState<{ clipId: string; side: 'left' | 'right'; startX: number } | null>(null);
    const [isDraggingScrubber, setIsDraggingScrubber] = useState(false);
    const [draggingClip, setDraggingClip] = useState<{ clipId: string; startX: number; startY: number; initialStartTime: number; initialLayerIndex: number; currentStartTime?: number; currentLayerIndex?: number } | null>(null);
    const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
    const [editingLayerName, setEditingLayerName] = useState<string>('');
    const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
    const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
    const [dropPosition, setDropPosition] = useState<'above' | 'below' | null>(null);

    // Format time for display
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 10);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
    };

    // Handle seeking on timeline (click or drag)
    const seekToPosition = (clientX: number) => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const scrollLeft = timelineRef.current.scrollLeft;
        const time = (x + scrollLeft) / PIXELS_PER_SECOND;
        onSeek(Math.max(0, Math.min(time, duration)));
    };

    const handleTimelineClick = (e: React.MouseEvent) => {
        seekToPosition(e.clientX);
    };

    const handleTimelineMouseDown = (e: React.MouseEvent) => {
        // Only start dragging if clicking on empty timeline (not on clips)
        if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.timeline-background')) {
            setIsDraggingScrubber(true);
            seekToPosition(e.clientX);
        }
    };

    const handleClipHover = (e: React.MouseEvent, clip: TimelineClip) => {
        if (clip.type !== 'video') return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const relativeTime = (x / rect.width) * clip.duration;
        const time = (clip.trimStart || 0) + relativeTime;

        setHoverPreview({
            clip,
            time,
            x: e.clientX,
            y: rect.top - 10
        });
    };

    // Keyboard shortcuts for zoom
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    onZoomChange(Math.min(5, zoom + 0.5));
                } else if (e.key === '-') {
                    e.preventDefault();
                    onZoomChange(Math.max(0.5, zoom - 0.5));
                } else if (e.key === '0') {
                    e.preventDefault();
                    onZoomChange(1);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [zoom, onZoomChange]);

    // Mouse wheel zoom
    useEffect(() => {
        const timelineEl = timelineRef.current;
        if (!timelineEl) return;

        const handleWheel = (e: WheelEvent) => {
            // Check if hovering over the tracks area (not the toolbar or scrollbar)
            const target = e.target as HTMLElement;
            const isOverTracks = target.closest('.timeline-tracks') || target.classList.contains('timeline-tracks');

            // Zoom with Ctrl+Scroll (anywhere on timeline) or regular scroll over tracks
            if (e.ctrlKey || e.metaKey || isOverTracks) {
                // Only prevent default when zooming, allow horizontal scroll otherwise
                if (Math.abs(e.deltaY) > 0) {
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? -0.25 : 0.25;
                    onZoomChange(Math.max(0.5, Math.min(5, zoom + delta)));
                }
            }
        };

        timelineEl.addEventListener('wheel', handleWheel, { passive: false });
        return () => timelineEl.removeEventListener('wheel', handleWheel);
    }, [zoom, onZoomChange]);

    // Handle trim dragging
    useEffect(() => {
        if (!trimming) return;

        const handleMouseMove = (e: MouseEvent) => {
            const clip = clips.find(c => c.id === trimming.clipId);
            if (!clip) return;

            const deltaX = e.clientX - trimming.startX;
            const deltaTime = deltaX / PIXELS_PER_SECOND;

            if (clip.type === 'image') {
                // For images: adjust duration by dragging edges
                const minDuration = 0.5; // Minimum 0.5 seconds

                if (trimming.side === 'left') {
                    // Left handle: adjust startTime and duration to keep end position fixed
                    const newStartTime = Math.max(0, clip.startTime + deltaTime);
                    const endTime = clip.startTime + clip.duration;
                    const newDuration = Math.max(minDuration, endTime - newStartTime);

                    // Check for collisions with other clips on the same layer
                    const otherClipsOnLayer = clips.filter(c =>
                        c.id !== clip.id &&
                        (c.layerIndex ?? 0) === (clip.layerIndex ?? 0)
                    );

                    let finalStartTime = newStartTime;
                    for (const otherClip of otherClipsOnLayer) {
                        const otherEnd = otherClip.startTime + otherClip.duration;
                        // If new start would overlap with another clip
                        if (finalStartTime < otherEnd && endTime > otherClip.startTime) {
                            finalStartTime = otherEnd; // Snap to end of other clip
                        }
                    }

                    const finalDuration = Math.max(minDuration, endTime - finalStartTime);

                    onUpdateClip(clip.id, {
                        startTime: finalStartTime,
                        duration: finalDuration
                    });
                } else {
                    // Right handle: simply adjust duration
                    const newDuration = Math.max(minDuration, clip.duration + deltaTime);

                    // Check for collisions when extending
                    const newEndTime = clip.startTime + newDuration;
                    const otherClipsOnLayer = clips.filter(c =>
                        c.id !== clip.id &&
                        (c.layerIndex ?? 0) === (clip.layerIndex ?? 0)
                    );

                    let finalDuration = newDuration;
                    for (const otherClip of otherClipsOnLayer) {
                        // If new end would overlap with another clip's start
                        if (newEndTime > otherClip.startTime && clip.startTime < otherClip.startTime) {
                            finalDuration = otherClip.startTime - clip.startTime;
                        }
                    }

                    finalDuration = Math.max(minDuration, finalDuration);

                    onUpdateClip(clip.id, {
                        duration: finalDuration
                    });
                }
            } else {
                // For videos: trim the video content
                const originalDuration = clip.originalDuration || clip.duration;

                if (trimming.side === 'left') {
                    // Trim from start - can extend back to 0 (original start)
                    const currentTrimStart = clip.trimStart || 0;
                    const currentTrimEnd = clip.trimEnd || originalDuration;

                    // Allow dragging left to reduce trimStart (extend clip) or right to increase it (trim more)
                    const newTrimStart = Math.max(0, Math.min(currentTrimEnd - 0.5, currentTrimStart + deltaTime));
                    const newDuration = currentTrimEnd - newTrimStart;

                    onUpdateClip(clip.id, {
                        trimStart: newTrimStart,
                        duration: newDuration
                    });
                } else {
                    // Trim from end - can extend back to originalDuration
                    const currentTrimStart = clip.trimStart || 0;
                    const currentTrimEnd = clip.trimEnd || originalDuration;

                    // Allow dragging right to increase trimEnd (extend clip) or left to decrease it (trim more)
                    const newTrimEnd = Math.max(currentTrimStart + 0.5, Math.min(originalDuration, currentTrimEnd + deltaTime));
                    const newDuration = newTrimEnd - currentTrimStart;

                    onUpdateClip(clip.id, {
                        trimEnd: newTrimEnd,
                        duration: newDuration
                    });
                }
            }

            setTrimming({ ...trimming, startX: e.clientX });
        };

        const handleMouseUp = () => {
            setTrimming(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [trimming, clips, PIXELS_PER_SECOND, onUpdateClip]);

    // Handle scrubber dragging
    useEffect(() => {
        if (!isDraggingScrubber) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!timelineRef.current) return;
            const rect = timelineRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const scrollLeft = timelineRef.current.scrollLeft;
            const time = (x + scrollLeft) / PIXELS_PER_SECOND;
            onSeek(Math.max(0, Math.min(time, duration)));
        };

        const handleMouseUp = () => {
            setIsDraggingScrubber(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingScrubber, PIXELS_PER_SECOND, duration, onSeek]);

    // Handle clip dragging (moving clips along timeline and between layers)
    useEffect(() => {
        if (!draggingClip) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!timelineRef.current) return;

            const currentClip = clips.find(c => c.id === draggingClip.clipId);
            if (!currentClip) return;

            const deltaX = e.clientX - draggingClip.startX;
            const deltaTime = deltaX / PIXELS_PER_SECOND;
            let newStartTime = Math.max(0, draggingClip.initialStartTime + deltaTime);

            // Calculate which layer the mouse is over
            const timelineRect = timelineRef.current.getBoundingClientRect();
            const relativeY = e.clientY - timelineRect.top + timelineRef.current.scrollTop;

            // Find the layer at this Y position by checking sorted layers
            const sortedLayers = [...layers].sort((a, b) => b.index - a.index);
            let currentY = 16; // py-4 = 1rem = 16px padding at top
            let targetLayerIndex = draggingClip.initialLayerIndex;

            for (const layer of sortedLayers) {
                const layerHeight = layer.height || 80;
                if (relativeY >= currentY && relativeY < currentY + layerHeight) {
                    targetLayerIndex = layer.index;
                    if (!layer.locked) {
                        setDragOverLayerId(layer.id);
                    }
                    break;
                }
                currentY += layerHeight + 8; // 8px is space-y-2
            }

            // Collision detection: prevent overlap on the same layer
            const otherClipsOnLayer = clips.filter(c =>
                c.id !== draggingClip.clipId &&
                (c.layerIndex ?? 0) === targetLayerIndex
            );

            const clipEndTime = newStartTime + currentClip.duration;
            const snapThreshold = 0.5; // Snap within 0.5 seconds

            // Check for collisions and snap to adjacent clips
            for (const otherClip of otherClipsOnLayer) {
                const otherStart = otherClip.startTime;
                const otherEnd = otherClip.startTime + otherClip.duration;

                // If dragged clip would overlap with other clip
                if (newStartTime < otherEnd && clipEndTime > otherStart) {
                    // Determine which edge to snap to
                    const distanceToStart = Math.abs(newStartTime - otherEnd);
                    const distanceToEnd = Math.abs(clipEndTime - otherStart);

                    if (distanceToStart < distanceToEnd) {
                        // Snap to end of other clip
                        newStartTime = otherEnd;
                    } else {
                        // Snap to start of other clip
                        newStartTime = otherStart - currentClip.duration;
                    }
                }
                // Snap to adjacent clips if close enough
                else if (Math.abs(clipEndTime - otherStart) < snapThreshold) {
                    // Snap end to other's start
                    newStartTime = otherStart - currentClip.duration;
                } else if (Math.abs(newStartTime - otherEnd) < snapThreshold) {
                    // Snap start to other's end
                    newStartTime = otherEnd;
                }
            }

            // Ensure start time is not negative
            newStartTime = Math.max(0, newStartTime);

            // Update dragging state for visual feedback only (no re-render of clips)
            setDraggingClip(prev => prev ? {
                ...prev,
                currentStartTime: newStartTime,
                currentLayerIndex: targetLayerIndex
            } : null);
        };

        const handleMouseUp = () => {
            // Apply final position with 0.1s precision on mouse up
            if (draggingClip) {
                const finalStartTime = draggingClip.currentStartTime ?? draggingClip.initialStartTime;
                const finalLayerIndex = draggingClip.currentLayerIndex ?? draggingClip.initialLayerIndex;

                onUpdateClip(draggingClip.clipId, {
                    startTime: Math.round(finalStartTime * 10) / 10,
                    layerIndex: finalLayerIndex
                });
            }
            setDraggingClip(null);
            setDragOverLayerId(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingClip, PIXELS_PER_SECOND, onUpdateClip, clips, layers]);

    // Sync horizontal scroll between timeline and time ruler
    useEffect(() => {
        const timelineEl = timelineRef.current;
        const timeRuler = document.getElementById('timeRuler');
        if (!timelineEl || !timeRuler) return;

        const handleScroll = () => {
            timeRuler.style.transform = `translateX(-${timelineEl.scrollLeft}px)`;
        };

        timelineEl.addEventListener('scroll', handleScroll);
        return () => timelineEl.removeEventListener('scroll', handleScroll);
    }, []);

    // Sync vertical scroll between layer controls and timeline tracks
    useEffect(() => {
        const layerControls = document.getElementById('layerControls');
        const timelineTracks = document.getElementById('timelineTracks');
        if (!layerControls || !timelineTracks) return;

        let isLayerScrolling = false;
        let isTimelineScrolling = false;

        const handleLayerScroll = () => {
            if (isTimelineScrolling) return;
            isLayerScrolling = true;
            timelineTracks.scrollTop = layerControls.scrollTop;
            setTimeout(() => { isLayerScrolling = false; }, 10);
        };

        const handleTimelineScroll = () => {
            if (isLayerScrolling) return;
            isTimelineScrolling = true;
            layerControls.scrollTop = timelineTracks.scrollTop;
            setTimeout(() => { isTimelineScrolling = false; }, 10);
        };

        layerControls.addEventListener('scroll', handleLayerScroll);
        timelineTracks.addEventListener('scroll', handleTimelineScroll);

        return () => {
            layerControls.removeEventListener('scroll', handleLayerScroll);
            timelineTracks.removeEventListener('scroll', handleTimelineScroll);
        };
    }, []);

    return (
        <div className="flex-1 bg-[#09090b] border-t border-gray-800 flex flex-col overflow-hidden">
            {/* Timeline Toolbar */}
            <div className="h-10 border-b border-gray-800 flex items-center justify-between px-4 bg-[#18181b]">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onSplit}
                        disabled={!selectedClipId}
                        className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                    >
                        <Scissors size={14} />
                        Split
                    </button>
                    <button
                        onClick={onCloseGaps}
                        disabled={clips.length < 2}
                        className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                        title="Close gaps between clips"
                    >
                        <AlignHorizontalJustifyStart size={14} />
                        Close Gaps
                    </button>
                    <div className="w-px h-4 bg-gray-700" />
                    <span className="text-xs text-gray-500 font-mono">
                        {clips.length} Clips • {duration.toFixed(1)}s
                    </span>
                    {copiedClip && (
                        <>
                            <div className="w-px h-4 bg-gray-700" />
                            <span className="text-xs text-purple-400 font-bold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
                                Copied: {copiedClip.type}
                            </span>
                        </>
                    )}
                    <div className="w-px h-4 bg-gray-700" />
                    <span className="text-[10px] text-gray-600 font-medium">
                        Tip: Scroll to zoom • Click/drag to scrub • Ctrl+C/V to copy/paste
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onZoomChange(Math.max(0.5, zoom - 0.5))}
                        className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                        title="Zoom out (Ctrl + -)"
                    >
                        <ZoomOut size={16} />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden cursor-pointer"
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = e.clientX - rect.left;
                                const percentage = x / rect.width;
                                const newZoom = 0.5 + (percentage * 4.5); // 0.5 to 5
                                onZoomChange(Math.max(0.5, Math.min(5, newZoom)));
                            }}
                        >
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                                style={{ width: `${((zoom - 0.5) / 4.5) * 100}%` }}
                            />
                        </div>
                        <span className="text-xs font-mono text-gray-400 w-10 text-right">
                            {Math.round(zoom * 100)}%
                        </span>
                    </div>
                    <button
                        onClick={() => onZoomChange(Math.min(5, zoom + 0.5))}
                        className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                        title="Zoom in (Ctrl + +)"
                    >
                        <ZoomIn size={16} />
                    </button>
                    <button
                        onClick={() => onZoomChange(1)}
                        className="px-2 py-1 text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                        title="Reset zoom (Ctrl + 0)"
                    >
                        Reset
                    </button>
                </div>
            </div>

            {/* Timeline Area - Split into Layer Controls + Scrollable Timeline */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Headers Row */}
                <div className="flex shrink-0">
                    {/* Layer Controls Header */}
                    <div className="w-48 h-6 border-b border-r border-gray-800 px-3 flex items-center justify-between bg-[#18181b]">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Layers</span>
                        <button
                            onClick={onAddLayer}
                            className="p-0.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                            title="Add new layer"
                        >
                            <Plus size={12} />
                        </button>
                    </div>
                    {/* Timeline Header - Time Ruler */}
                    <div className="flex-1 h-6 border-b border-gray-800 bg-[#09090b] overflow-hidden relative">
                        <div
                            className="absolute top-0 left-0 h-full"
                            id="timeRuler"
                            style={{
                                width: `${Math.max(duration * PIXELS_PER_SECOND + 200, 1000)}px`
                            }}
                        >
                            {(() => {
                                // Adaptive grid based on zoom level
                                const totalSeconds = Math.ceil(duration + 10);
                                const markers: React.ReactElement[] = [];

                                // Determine marker interval based on zoom
                                let majorInterval = 5; // seconds between labeled markers
                                let minorInterval = 1; // seconds between small tick marks

                                if (zoom >= 3) {
                                    // Very zoomed in: show 0.5s intervals
                                    majorInterval = 2;
                                    minorInterval = 0.5;
                                } else if (zoom >= 1.5) {
                                    // Zoomed in: show 1s intervals
                                    majorInterval = 5;
                                    minorInterval = 1;
                                } else if (zoom < 0.7) {
                                    // Zoomed out: show 10s intervals
                                    majorInterval = 10;
                                    minorInterval = 5;
                                }

                                for (let t = 0; t <= totalSeconds; t += minorInterval) {
                                    const isMajor = t % majorInterval === 0;
                                    markers.push(
                                        <div
                                            key={t}
                                            className={`absolute top-0 border-l ${isMajor ? 'border-gray-600 h-full' : 'border-gray-800 h-2'}`}
                                            style={{ left: `${t * PIXELS_PER_SECOND}px` }}
                                        >
                                            {isMajor && (
                                                <span className="text-[10px] text-gray-400 pl-1 font-mono absolute top-0 left-0 whitespace-nowrap">
                                                    {Math.floor(t / 60) > 0
                                                        ? `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`
                                                        : `${t}s`
                                                    }
                                                </span>
                                            )}
                                        </div>
                                    );
                                }
                                return markers;
                            })()}
                        </div>
                    </div>
                </div>

                {/* Scrollable Content Row */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Layer Controls Sidebar */}
                    <div className="w-48 border-r border-gray-800 bg-[#18181b] shrink-0 overflow-y-auto" id="layerControls">
                        {/* Layer list */}
                        <div className="py-4 space-y-2">
                        {[...layers].sort((a, b) => b.index - a.index).map((layer) => {
                            const layerClips = clips.filter(c => (c.layerIndex ?? 0) === layer.index);
                            const layerHeight = layer.height || 80;
                            return (
                                <div
                                    key={layer.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.effectAllowed = 'move';
                                        setDraggingLayerId(layer.id);
                                    }}
                                    onDragEnd={() => {
                                        setDraggingLayerId(null);
                                        setDragOverLayerId(null);
                                        setDropPosition(null);
                                    }}
                                    onDragOver={(e) => {
                                        if (!draggingLayerId || draggingLayerId === layer.id) return;
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';

                                        // Determine if dropping above or below based on mouse position
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const midpoint = rect.top + rect.height / 2;
                                        const position = e.clientY < midpoint ? 'above' : 'below';

                                        setDragOverLayerId(layer.id);
                                        setDropPosition(position);
                                    }}
                                    onDragLeave={(e) => {
                                        if (e.currentTarget === e.target) {
                                            setDragOverLayerId(null);
                                            setDropPosition(null);
                                        }
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        if (!draggingLayerId || draggingLayerId === layer.id) return;

                                        const draggedLayer = layers.find(l => l.id === draggingLayerId);
                                        if (!draggedLayer) return;

                                        // Calculate new index based on drop position
                                        let newIndex = layer.index;
                                        if (dropPosition === 'above') {
                                            // If sorted descending (higher index on top), above means higher index
                                            newIndex = layer.index + 1;
                                        } else {
                                            // Below means lower index
                                            newIndex = layer.index;
                                        }

                                        // Adjust if dragging from higher to lower
                                        if (draggedLayer.index > layer.index && dropPosition === 'above') {
                                            newIndex = layer.index + 1;
                                        } else if (draggedLayer.index < layer.index && dropPosition === 'below') {
                                            newIndex = layer.index - 1;
                                        }

                                        onReorderLayer(draggingLayerId, newIndex);
                                        setDraggingLayerId(null);
                                        setDragOverLayerId(null);
                                        setDropPosition(null);
                                    }}
                                    className={`px-2 hover:bg-gray-800/50 transition-colors flex flex-col justify-center border-b border-gray-800/50 relative ${
                                        draggingLayerId === layer.id ? 'opacity-50' : ''
                                    }`}
                                    style={{ height: `${layerHeight}px` }}
                                >
                                    {/* Drop indicator line */}
                                    {dragOverLayerId === layer.id && dropPosition && (
                                        <div
                                            className="absolute left-0 right-0 h-0.5 bg-purple-500 z-50"
                                            style={{
                                                top: dropPosition === 'above' ? '-1px' : 'auto',
                                                bottom: dropPosition === 'below' ? '-1px' : 'auto'
                                            }}
                                        />
                                    )}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => onToggleLayerVisibility(layer.id)}
                                            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                                            title={layer.visible ? 'Hide layer' : 'Show layer'}
                                        >
                                            {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                        </button>
                                        <button
                                            onClick={() => onToggleLayerLock(layer.id)}
                                            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                                            title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                                        >
                                            {layer.locked ? <Lock size={12} /> : <LockOpen size={12} />}
                                        </button>
                                        {editingLayerId === layer.id ? (
                                            <input
                                                type="text"
                                                value={editingLayerName}
                                                onChange={(e) => setEditingLayerName(e.target.value)}
                                                onBlur={() => {
                                                    onRenameLayer(layer.id, editingLayerName);
                                                    setEditingLayerId(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        onRenameLayer(layer.id, editingLayerName);
                                                        setEditingLayerId(null);
                                                    } else if (e.key === 'Escape') {
                                                        setEditingLayerId(null);
                                                    }
                                                }}
                                                autoFocus
                                                className="flex-1 bg-gray-700 text-white text-xs px-1 py-0.5 rounded border border-purple-500 outline-none"
                                            />
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setEditingLayerId(layer.id);
                                                    setEditingLayerName(layer.name);
                                                }}
                                                className="flex-1 text-left text-xs text-gray-300 hover:text-white truncate"
                                                title={layer.name}
                                            >
                                                {layer.name}
                                            </button>
                                        )}
                                        {layers.length > 1 && (
                                            <button
                                                onClick={() => onRemoveLayer(layer.id)}
                                                className="p-1 hover:bg-red-900/30 rounded text-gray-500 hover:text-red-400 transition-colors"
                                                title="Delete layer"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-gray-600 ml-12">
                                        {layerClips.length} clip{layerClips.length !== 1 ? 's' : ''}
                                    </div>
                                </div>
                            );
                        })}
                        </div>
                    </div>

                    {/* Scrollable Timeline */}
                    <div className="flex-1 overflow-x-auto overflow-y-auto relative custom-scrollbar" ref={timelineRef} id="timelineTracks">
                    <div
                        className="h-full relative min-w-full timeline-background"
                        style={{
                            width: `${Math.max(duration * PIXELS_PER_SECOND + 200, 1000)}px`,
                            cursor: isDraggingScrubber ? 'grabbing' : 'default'
                        }}
                        onClick={handleTimelineClick}
                        onMouseDown={handleTimelineMouseDown}
                    >
                        {/* Playhead */}
                    <div
                        className={`absolute top-0 bottom-0 w-px bg-white z-20 pointer-events-none transition-all ${isDraggingScrubber ? 'shadow-[0_0_10px_rgba(255,255,255,0.8)]' : ''
                            }`}
                        style={{ left: `${currentTime * PIXELS_PER_SECOND}px` }}
                    >
                        <div className={`absolute -top-1 -left-1.5 w-3 h-3 bg-white rotate-45 rounded-sm transition-transform ${isDraggingScrubber ? 'scale-125' : ''
                            }`} />
                        {/* Time indicator on playhead */}
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap">
                            {formatTime(currentTime)}
                        </div>
                    </div>

                        {/* Tracks */}
                        <div className="py-4 space-y-2 timeline-background timeline-tracks">
                            {[...layers].sort((a, b) => b.index - a.index).map((layer) => {
                                const layerClips = clips.filter(c => (c.layerIndex ?? 0) === layer.index);
                                const layerHeight = layer.height || 80;

                                return (
                                    <div
                                        key={layer.id}
                                        className={`relative border-b timeline-background timeline-tracks ${
                                            !layer.visible ? 'opacity-40' : ''
                                        } ${dragOverLayerId === layer.id ? 'ring-4 ring-purple-500 ring-inset bg-purple-500/10' : ''}`}
                                        style={{
                                            height: `${layerHeight}px`,
                                            backgroundColor: layer.index % 2 === 0 ? 'rgba(24, 24, 27, 0.5)' : 'rgba(24, 24, 27, 0.3)',
                                            borderColor: 'rgba(75, 85, 99, 0.5)'
                                        }}
                                        onDragOver={(e) => {
                                            if (!onDropAsset || layer.locked) return;
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'copy';
                                            setDragOverLayerId(layer.id);
                                        }}
                                        onDragLeave={(e) => {
                                            // Only clear if leaving the layer div itself
                                            if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
                                                setDragOverLayerId(null);
                                            }
                                        }}
                                        onDrop={(e) => {
                                            if (!onDropAsset || layer.locked) return;
                                            e.preventDefault();
                                            setDragOverLayerId(null);

                                            try {
                                                const jsonData = e.dataTransfer.getData('application/json');
                                                // If no JSON data, this is a clip repositioning within timeline, not a drop from sidebar
                                                if (!jsonData) return;

                                                const data = JSON.parse(jsonData);
                                                const { asset, type } = data;

                                                // Calculate drop time from mouse position
                                                if (!timelineRef.current) return;
                                                const rect = timelineRef.current.getBoundingClientRect();
                                                const x = e.clientX - rect.left;
                                                const scrollLeft = timelineRef.current.scrollLeft;
                                                const time = Math.max(0, (x + scrollLeft) / PIXELS_PER_SECOND);

                                                onDropAsset(asset, type, layer.index, time);
                                            } catch (error) {
                                                console.error('Failed to parse drop data:', error);
                                            }
                                        }}
                                    >
                                        {layerClips.map((clip) => (
                                            <div
                                                key={clip.id}
                                                onClick={(e) => {
                                                    if (layer.locked) return;
                                                    e.stopPropagation();
                                                    onSelectClip(clip.id);
                                                }}
                                                onMouseDown={(e) => {
                                                    if (layer.locked) return;
                                                    // Only start dragging if clicking on the clip body (not trim handles)
                                                    if ((e.target as HTMLElement).closest('.trim-handle')) return;
                                                    e.stopPropagation();
                                                    setDraggingClip({
                                                        clipId: clip.id,
                                                        startX: e.clientX,
                                                        startY: e.clientY,
                                                        initialStartTime: clip.startTime,
                                                        initialLayerIndex: clip.layerIndex ?? 0
                                                    });
                                                    onSelectClip(clip.id);
                                                }}
                                                onMouseMove={(e) => clip.type === 'video' && handleClipHover(e, clip)}
                                                onMouseLeave={() => setHoverPreview(null)}
                                                className={`absolute top-2 bottom-2 rounded-md overflow-hidden transition-all group box-border ${
                                                    layer.locked ? 'cursor-not-allowed' : (draggingClip?.clipId === clip.id ? 'cursor-grabbing opacity-60' : 'cursor-grab')
                                                } ${
                                                    selectedClipId === clip.id
                                                        ? 'ring-2 ring-purple-500 ring-inset z-10'
                                                        : 'ring-1 ring-gray-700 ring-inset hover:ring-gray-500'
                                                }`}
                                                style={{
                                                    left: `${(draggingClip?.clipId === clip.id && draggingClip.currentStartTime !== undefined ? draggingClip.currentStartTime : clip.startTime) * PIXELS_PER_SECOND}px`,
                                                    width: `${clip.duration * PIXELS_PER_SECOND}px`
                                                }}
                                            >
                                                {/* Clip Content */}
                                                {clip.type === 'video' ? (
                                                    <div className="w-full h-full bg-gray-800 relative overflow-hidden">
                                                        <VideoFramePreview
                                                            videoUrl={clip.url}
                                                            duration={clip.originalDuration || clip.duration}
                                                            width={clip.duration * PIXELS_PER_SECOND}
                                                            trimStart={clip.trimStart}
                                                            trimEnd={clip.trimEnd}
                                                        />
                                                    </div>
                                                ) : clip.type === 'image' ? (
                                                    <img src={clip.thumbnailUrl || clip.url} className="w-full h-full object-contain opacity-80 bg-gray-900" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-green-600/80 to-blue-600/80">
                                                        <span className="text-white text-lg">🎵</span>
                                                    </div>
                                                )}

                                                {/* Clip Info */}
                                                <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1 rounded font-mono">
                                                    {clip.duration.toFixed(1)}s
                                                </div>
                                                {clip.text && (
                                                    <div className="absolute top-1 left-1 bg-purple-500/80 text-white text-[9px] px-1 rounded font-bold">
                                                        T
                                                    </div>
                                                )}
                                                {clip.volume !== undefined && clip.volume < 100 && (
                                                    <div className="absolute top-1 right-1 bg-black/70 text-white text-[9px] px-1 rounded font-mono">
                                                        {clip.volume}%
                                                    </div>
                                                )}
                                                {clip.smartCut && (
                                                    <div className="absolute top-1 right-8 bg-green-500/80 text-white text-[9px] px-1 rounded font-bold" title="Smart Cut enabled">
                                                        ✂️
                                                    </div>
                                                )}

                                                {/* Trim/Extend Handles (for video and image clips) */}
                                                {(clip.type === 'video' || clip.type === 'image') && !layer.locked && (
                                                    <>
                                                        {/* Left trim handle */}
                                                        <div
                                                            className="trim-handle absolute left-0 top-0 bottom-0 w-3 bg-yellow-400/0 hover:bg-yellow-400/30 cursor-ew-resize group/trim z-20"
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation();
                                                                setTrimming({ clipId: clip.id, side: 'left', startX: e.clientX });
                                                            }}
                                                            title={clip.type === 'image' ? 'Drag to adjust start time' : `Drag to ${(clip.trimStart || 0) > 0 ? 'extend or trim' : 'trim'} start`}
                                                        >
                                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-400 opacity-60 group-hover/trim:opacity-100 transition-opacity" />
                                                            {(clip.trimStart || 0) > 0 && (
                                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full text-center pointer-events-none">
                                                                    <div className="text-yellow-400 text-xs font-bold">←</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Right trim handle */}
                                                        <div
                                                            className="trim-handle absolute right-0 top-0 bottom-0 w-3 bg-yellow-400/0 hover:bg-yellow-400/30 cursor-ew-resize group/trim z-20"
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation();
                                                                setTrimming({ clipId: clip.id, side: 'right', startX: e.clientX });
                                                            }}
                                                            title={clip.type === 'image' ? 'Drag to adjust duration' : `Drag to ${(clip.trimEnd || (clip.originalDuration || clip.duration)) < (clip.originalDuration || clip.duration) ? 'extend or trim' : 'trim'} end`}
                                                        >
                                                            <div className="absolute right-0 top-0 bottom-0 w-1 bg-yellow-400 opacity-60 group-hover/trim:opacity-100 transition-opacity" />
                                                            {(clip.trimEnd || (clip.originalDuration || clip.duration)) < (clip.originalDuration || clip.duration) && (
                                                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-full text-center pointer-events-none">
                                                                    <div className="text-yellow-400 text-xs font-bold">→</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}

                                        {/* Empty Layer Indicator */}
                                        {layerClips.length === 0 && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <span className="text-xs text-gray-700/50 font-bold uppercase tracking-widest">
                                                    {layer.name}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                </div> {/* End Scrollable Content Row */}
            </div> {/* End Timeline Area */}

            {/* Hover Preview */}
            {hoverPreview && (
                <div
                    className="fixed z-50 pointer-events-none"
                    style={{
                        left: `${hoverPreview.x}px`,
                        top: `${hoverPreview.y}px`,
                        transform: 'translate(-50%, -100%)',
                        marginTop: '-8px'
                    }}
                >
                    <div className="bg-gray-900 border-2 border-purple-500 rounded-lg overflow-hidden shadow-2xl">
                        {/* Larger preview with maintained aspect ratio */}
                        <div className="bg-black relative" style={{ width: '240px', height: '135px' }}>
                            <video
                                src={hoverPreview.clip.url}
                                className="w-full h-full object-contain"
                                autoPlay={false}
                                muted
                                playsInline
                                ref={(video) => {
                                    if (video) {
                                        video.currentTime = hoverPreview.time;
                                    }
                                }}
                            />
                            {/* Frame border indicator */}
                            <div className="absolute inset-0 border border-white/10 pointer-events-none" />
                        </div>
                        <div className="px-3 py-1.5 bg-gray-900 flex items-center justify-between gap-2">
                            <p className="text-xs text-purple-400 font-bold">
                                {hoverPreview.time.toFixed(2)}s
                            </p>
                            <p className="text-[10px] text-gray-400 font-mono">
                                Hover to scrub
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
