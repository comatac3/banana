import { useState, useRef, useEffect } from 'react';
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Maximize,
    Volume2,
    VolumeX
} from 'lucide-react';

interface OverlayClip {
    id: string;
    url: string;
    startTime: number;
    duration: number;
    overlayX?: number;
    overlayY?: number;
    overlayScale?: number;
    overlayRotation?: number;
}

interface BaseClip {
    id: string;
    type: 'video' | 'image' | 'audio';
    url: string;
    startTime: number;
    duration: number;
    trimStart?: number;
    transition?: 'none' | 'fade' | 'slide';
    layer?: string;
    layerIndex?: number;
}

interface EditorPlayerProps {
    clip: { type: 'video' | 'image', url: string, startTime: number, trimStart: number } | null;
    overlayClips?: OverlayClip[];
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    allClips?: BaseClip[]; // All clips for transition detection
}

interface EditorPlayerPropsExtended extends EditorPlayerProps {
    onUpdateOverlay?: (id: string, updates: Partial<OverlayClip>) => void;
    selectedClipId?: string | null;
}

export default function EditorPlayer({
    clip,
    overlayClips = [],
    isPlaying,
    currentTime,
    duration,
    onPlayPause,
    onSeek,
    onUpdateOverlay,
    selectedClipId,
    allClips = []
}: EditorPlayerPropsExtended) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [rotatingOverlay, setRotatingOverlay] = useState<{ id: string; startAngle: number; startX: number; startY: number } | null>(null);
    const [draggingOverlay, setDraggingOverlay] = useState<{ id: string; startX: number; startY: number; initialOverlayX: number; initialOverlayY: number } | null>(null);

    // Video preloading cache
    const preloadedVideos = useRef<Map<string, HTMLVideoElement>>(new Map());
    const [isBuffering, setIsBuffering] = useState(false);
    const lastSyncTime = useRef<number>(0);

    // Preload upcoming videos for smooth transitions
    useEffect(() => {
        const videoClips = allClips.filter(c => c.type === 'video');

        videoClips.forEach(videoClip => {
            if (!preloadedVideos.current.has(videoClip.url)) {
                const preloadVideo = document.createElement('video');
                preloadVideo.preload = 'auto';
                preloadVideo.muted = true;
                preloadVideo.src = videoClip.url;
                preloadVideo.load();
                preloadedVideos.current.set(videoClip.url, preloadVideo);
            }
        });

        // Cleanup old preloaded videos not in current clips
        const currentUrls = new Set(videoClips.map(c => c.url));
        preloadedVideos.current.forEach((video, url) => {
            if (!currentUrls.has(url)) {
                video.src = '';
                preloadedVideos.current.delete(url);
            }
        });

        // Cleanup on unmount
        return () => {
            preloadedVideos.current.forEach(video => {
                video.src = '';
            });
            preloadedVideos.current.clear();
        };
    }, [allClips]);

    // Detect if we're in a transition
    const getTransitionState = () => {
        if (!clip || allClips.length < 2) return null;

        // Find current and next base layer clips
        const baseClips = allClips
            .filter(c => (c.type === 'video' || c.type === 'image') && (!c.layer || c.layer === 'base') && (c.layerIndex ?? 0) === 0)
            .sort((a, b) => a.startTime - b.startTime);

        const currentIndex = baseClips.findIndex(c =>
            currentTime >= c.startTime && currentTime < c.startTime + c.duration
        );

        if (currentIndex === -1 || currentIndex === baseClips.length - 1) return null;

        const currentClip = baseClips[currentIndex];
        const nextClip = baseClips[currentIndex + 1];

        // Check if next clip has a transition
        if (!nextClip.transition || nextClip.transition === 'none') return null;

        const transitionDuration = 0.5; // 0.5 seconds
        const currentClipEnd = currentClip.startTime + currentClip.duration;

        // Transition happens at the END of current clip (last 0.5s)
        const transitionStart = currentClipEnd - transitionDuration;
        const transitionEnd = currentClipEnd;

        // Check if we're in the transition period
        if (currentTime >= transitionStart && currentTime <= transitionEnd) {
            const progress = (currentTime - transitionStart) / transitionDuration;


            return {
                currentClip,
                nextClip,
                progress,
                type: nextClip.transition
            };
        }

        return null;
    };

    const transitionState = getTransitionState();

    // Filter overlay clips that are active at current time
    const activeOverlays = overlayClips.filter(overlay =>
        currentTime >= overlay.startTime && currentTime < overlay.startTime + overlay.duration
    );

    // Play/pause control
    useEffect(() => {
        if (videoRef.current && clip?.type === 'video') {
            if (isPlaying) {
                videoRef.current.playbackRate = 1.0;
                const playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {});
                }
            } else {
                videoRef.current.pause();
            }
        }
    }, [isPlaying, clip?.url]);

    // Sync video playback time with timeline - optimized for smooth playback
    useEffect(() => {
        if (!videoRef.current || clip?.type !== 'video') return;

        const video = videoRef.current;
        const relativeTime = currentTime - clip.startTime;
        const videoInternalTime = (clip.trimStart || 0) + relativeTime;

        // Only sync if video is ready
        if (videoInternalTime < 0 || video.readyState < 2) return;

        const timeDiff = Math.abs(video.currentTime - videoInternalTime);
        const now = performance.now();

        // Throttle sync to avoid too frequent seeks
        if (now - lastSyncTime.current < 100 && timeDiff < 0.5) return;

        // Large difference - hard seek
        if (timeDiff > 0.5) {
            video.currentTime = videoInternalTime;
            lastSyncTime.current = now;
        }
        // Small drift during playback - let video continue naturally
        // This prevents stuttering from constant small seeks
    }, [currentTime, clip]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleMute = () => {
        const newMuted = !isMuted;
        if (videoRef.current) videoRef.current.muted = newMuted;
        setIsMuted(newMuted);
    };

    // Handle overlay position dragging
    useEffect(() => {
        if (!draggingOverlay || !onUpdateOverlay || !playerContainerRef.current) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!playerContainerRef.current) return;

            const rect = playerContainerRef.current.getBoundingClientRect();
            const deltaX = e.clientX - draggingOverlay.startX;
            const deltaY = e.clientY - draggingOverlay.startY;

            // Convert pixel movement to 1920x1080 coordinate system
            const videoWidth = rect.width;
            const videoHeight = rect.height;
            const scaleX = 1920 / videoWidth;
            const scaleY = 1080 / videoHeight;

            const newOverlayX = Math.max(0, Math.min(1920, draggingOverlay.initialOverlayX + (deltaX * scaleX)));
            const newOverlayY = Math.max(0, Math.min(1080, draggingOverlay.initialOverlayY + (deltaY * scaleY)));

            // Use requestAnimationFrame for smooth updates
            // IMPORTANT: Only update position (X, Y), never scale during drag
            requestAnimationFrame(() => {
                onUpdateOverlay(draggingOverlay.id, {
                    overlayX: newOverlayX,
                    overlayY: newOverlayY
                    // overlayScale explicitly NOT updated here
                });
            });
        };

        const handleMouseUp = () => {
            // Round to nearest integer on mouse up
            if (playerContainerRef.current && onUpdateOverlay) {
                const overlay = overlayClips.find(o => o.id === draggingOverlay.id);
                if (overlay) {
                    onUpdateOverlay(draggingOverlay.id, {
                        overlayX: Math.round(overlay.overlayX ?? 960),
                        overlayY: Math.round(overlay.overlayY ?? 540)
                    });
                }
            }
            setDraggingOverlay(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingOverlay, onUpdateOverlay, overlayClips]);

    // Handle rotation dragging
    useEffect(() => {
        if (!rotatingOverlay || !onUpdateOverlay) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - rotatingOverlay.startX;
            const deltaAngle = deltaX * 0.5; // Sensitivity: 0.5 degrees per pixel
            let newRotation = rotatingOverlay.startAngle + deltaAngle;

            // Keep rotation between 0-360
            while (newRotation < 0) newRotation += 360;
            while (newRotation >= 360) newRotation -= 360;

            // Use requestAnimationFrame for smooth updates
            requestAnimationFrame(() => {
                onUpdateOverlay(rotatingOverlay.id, { overlayRotation: newRotation });
            });
        };

        const handleMouseUp = () => {
            // Round to nearest integer on mouse up
            if (onUpdateOverlay) {
                const overlay = overlayClips.find(o => o.id === rotatingOverlay.id);
                if (overlay) {
                    onUpdateOverlay(rotatingOverlay.id, {
                        overlayRotation: Math.round(overlay.overlayRotation ?? 0)
                    });
                }
            }
            setRotatingOverlay(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [rotatingOverlay, onUpdateOverlay, overlayClips]);

    return (
        <div className="flex flex-col bg-black relative group" style={{ height: 'calc(100vh - 12rem - 18rem)' }}>
            <div
                ref={playerContainerRef}
                className="flex-1 flex items-center justify-center p-4 relative overflow-hidden"
            >
                {clip ? (
                    <div className="relative max-h-full max-w-full bg-black" style={{ aspectRatio: '16/9', maxHeight: 'calc(100vh - 16rem - 18rem)' }}>
                        {/* Base video or image */}
                        {clip.type === 'video' ? (
                            <>
                                <video
                                    ref={videoRef}
                                    src={clip.url}
                                    className="w-full h-full shadow-2xl rounded-sm object-contain"
                                    preload="auto"
                                    onLoadedData={() => {
                                        setIsBuffering(false);
                                        if (videoRef.current && clip) {
                                            const relativeTime = currentTime - clip.startTime;
                                            const videoInternalTime = Math.max(0, (clip.trimStart || 0) + relativeTime);
                                            videoRef.current.currentTime = videoInternalTime;
                                            if (isPlaying) {
                                                videoRef.current.play().catch(() => {});
                                            }
                                        }
                                    }}
                                    onWaiting={() => setIsBuffering(true)}
                                    onPlaying={() => setIsBuffering(false)}
                                    onCanPlay={() => setIsBuffering(false)}
                                    muted={isMuted}
                                    playsInline
                                />
                                {/* Buffering indicator */}
                                {isBuffering && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                    </div>
                                )}
                            </>
                        ) : (
                            <img
                                src={clip.url}
                                alt="Preview"
                                className="w-full h-full shadow-2xl rounded-sm object-contain"
                            />
                        )}

                        {/* CSS Transition Effect Overlay */}
                        {transitionState && (
                            <>
                                {/* Fade transition: black overlay that fades in then out */}
                                {transitionState.type === 'fade' && (
                                    <div
                                        className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-100"
                                        style={{
                                            opacity: transitionState.progress < 0.5
                                                ? transitionState.progress * 2  // Fade to black (0 -> 1)
                                                : (1 - transitionState.progress) * 2  // Fade from black (1 -> 0)
                                        }}
                                    />
                                )}

                                {/* Slide transition: moving panel that slides across */}
                                {transitionState.type === 'slide' && (
                                    <div
                                        className="absolute inset-0 bg-gradient-to-r from-purple-900/80 to-blue-900/80 pointer-events-none transition-transform duration-100"
                                        style={{
                                            transform: `translateX(${-100 + (transitionState.progress * 100)}%)`
                                        }}
                                    />
                                )}

                                {/* Transition label */}
                                <div className="absolute top-4 right-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full font-medium backdrop-blur-sm border border-purple-500/30 pointer-events-none">
                                    {transitionState.type === 'fade' ? 'Fade' : 'Slide Left'} Transition
                                </div>
                            </>
                        )}

                        {/* Overlay images - positioned absolutely on top */}
                        {activeOverlays.map((overlay) => {
                            const overlayX = overlay.overlayX ?? 960; // Default center X
                            const overlayY = overlay.overlayY ?? 540; // Default center Y
                            const overlayScale = overlay.overlayScale ?? 0.5; // Default 50% scale
                            const overlayRotation = overlay.overlayRotation ?? 0; // Default 0° rotation
                            const isSelected = selectedClipId === overlay.id;

                            // Convert from 1920x1080 coordinate system to percentage
                            // Position is center point, so we need to translate to top-left for CSS
                            const xPercent = (overlayX / 1920) * 100;
                            const yPercent = (overlayY / 1080) * 100;

                            return (
                                <div
                                    key={overlay.id}
                                    className="absolute"
                                    style={{
                                        left: `${xPercent}%`,
                                        top: `${yPercent}%`,
                                        transform: 'translate(-50%, -50%)',
                                        zIndex: 10
                                    }}
                                >
                                    <div
                                        className="relative"
                                        style={{
                                            transform: `scale(${overlayScale}) rotate(${overlayRotation}deg)`,
                                            transformOrigin: 'center center'
                                        }}
                                    >
                                        <img
                                            src={overlay.url}
                                            alt="Overlay"
                                            className={`pointer-events-auto ${isSelected ? 'ring-2 ring-purple-500' : ''}`}
                                            style={{
                                                maxWidth: '100%',
                                                maxHeight: '100%',
                                                objectFit: 'contain',
                                                display: 'block',
                                                cursor: draggingOverlay?.id === overlay.id ? 'grabbing' : (isSelected ? 'grab' : 'pointer')
                                            }}
                                            onMouseDown={(e) => {
                                                if (!onUpdateOverlay || e.button !== 0) return; // Only left click
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDraggingOverlay({
                                                    id: overlay.id,
                                                    startX: e.clientX,
                                                    startY: e.clientY,
                                                    initialOverlayX: overlayX,
                                                    initialOverlayY: overlayY
                                                });
                                            }}
                                            onDragStart={(e) => e.preventDefault()}
                                            onWheel={(e) => {
                                                if (!onUpdateOverlay || draggingOverlay) return; // Don't resize while dragging
                                                e.preventDefault();
                                                e.stopPropagation();
                                                // Scroll to adjust scale
                                                const delta = e.deltaY > 0 ? -0.05 : 0.05;
                                                const newScale = Math.max(0.1, Math.min(2, overlayScale + delta));
                                                onUpdateOverlay(overlay.id, { overlayScale: newScale });
                                            }}
                                        />

                                        {/* Rotation handle - only show for selected overlay */}
                                        {isSelected && onUpdateOverlay && (
                                            <div
                                                className="absolute top-1 right-1 w-7 h-7 bg-purple-500 rounded-full cursor-grab active:cursor-grabbing flex items-center justify-center shadow-lg hover:bg-purple-400 transition-colors border-2 border-white z-20"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setRotatingOverlay({
                                                        id: overlay.id,
                                                        startAngle: overlayRotation,
                                                        startX: e.clientX,
                                                        startY: e.clientY
                                                    });
                                                }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center text-gray-600">
                        <div className="w-16 h-16 border-2 border-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4 border-dashed">
                            <Play size={24} className="opacity-50" />
                        </div>
                        <p className="text-sm font-medium">Add clips to timeline</p>
                    </div>
                )}
            </div>

            {/* Controls Bar */}
            <div className="h-14 bg-[#18181b] border-t border-gray-800 flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3 w-1/3">
                    <div className="flex items-baseline gap-1">
                        <span className="text-sm font-mono font-bold text-white">
                            {formatTime(currentTime)}
                        </span>
                        <span className="text-xs text-gray-600">/</span>
                        <span className="text-xs font-mono text-gray-400">
                            {formatTime(duration)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4 justify-center w-1/3">
                    <button
                        onClick={() => onSeek(0)}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <SkipBack size={16} />
                    </button>
                    <button
                        onClick={onPlayPause}
                        className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform relative group"
                        title="Play/Pause (Space)"
                    >
                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Space
                        </div>
                    </button>
                    <button
                        onClick={() => onSeek(duration)}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <SkipForward size={16} />
                    </button>
                </div>

                <div className="flex items-center gap-4 justify-end w-1/3">
                    <div className="flex items-center gap-2 group/vol">
                        <button onClick={toggleMute} className="text-gray-400 hover:text-white">
                            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                        <div className="w-20 h-1 bg-gray-700 rounded-full overflow-hidden cursor-pointer">
                            <div
                                className="h-full bg-white w-full"
                                style={{ width: isMuted ? '0%' : `${volume * 100}%` }}
                            />
                        </div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                        <Maximize size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
