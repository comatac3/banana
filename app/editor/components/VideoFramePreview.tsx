import { useMemo, useEffect, useRef, useState } from 'react';

interface VideoFramePreviewProps {
    videoUrl: string;
    duration: number;
    width: number;
    trimStart?: number;
    trimEnd?: number;
}

// Sub-component for individual frames to handle seeking reliably
const PreviewFrame = ({ url, timestamp }: { url: string, timestamp: number }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Reset loaded state when timestamp changes
        setLoaded(false);

        const handleReady = () => {
            setLoaded(true);
        };

        const handleSeek = () => {
            setLoaded(true);
        };

        const handleLoadedData = () => {
            // Video data is loaded, now seek to timestamp
            video.currentTime = timestamp;
        };

        video.addEventListener('loadeddata', handleLoadedData);
        video.addEventListener('seeked', handleSeek);
        video.addEventListener('loadedmetadata', handleReady);

        // If video is already loaded, seek immediately
        if (video.readyState >= 2) {
            video.currentTime = timestamp;
        }

        return () => {
            video.removeEventListener('loadeddata', handleLoadedData);
            video.removeEventListener('seeked', handleSeek);
            video.removeEventListener('loadedmetadata', handleReady);
        };
    }, [timestamp, url]);

    return (
        <div className="flex-1 min-w-0 border-r border-gray-700/30 last:border-r-0 overflow-hidden bg-black relative">
            <video
                ref={videoRef}
                src={url}
                className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                muted
                playsInline
                preload="auto"
                style={{
                    pointerEvents: 'none',
                    imageRendering: 'auto'
                }}
            />
            {/* Subtle frame separator */}
            <div className="absolute top-0 bottom-0 left-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
        </div>
    );
};

export default function VideoFramePreview({
    videoUrl,
    duration,
    width,
    trimStart = 0,
    trimEnd
}: VideoFramePreviewProps) {
    // Calculate frame count based on width
    const frameCount = useMemo(() => {
        // Use smaller pixel width per frame for more detail
        const pixelsPerFrame = 40;
        const calculatedFrames = Math.ceil(width / pixelsPerFrame);
        // Minimum 3 frames, maximum 60 frames
        return Math.max(3, Math.min(calculatedFrames, 60));
    }, [width]);

    const effectiveStart = trimStart;
    const effectiveEnd = trimEnd || duration;
    const effectiveDuration = effectiveEnd - effectiveStart;

    // Generate timestamps for each frame - spread evenly across trimmed portion
    const frameTimestamps = useMemo(() => {
        const timestamps: number[] = [];

        if (frameCount === 1) {
            // Single frame: show middle of trimmed section
            timestamps.push(effectiveStart + effectiveDuration / 2);
        } else {
            // Multiple frames: distribute evenly from trimStart to trimEnd
            for (let i = 0; i < frameCount; i++) {
                const timestamp = effectiveStart + (effectiveDuration * i) / (frameCount - 1);
                timestamps.push(Math.min(timestamp, effectiveEnd - 0.1)); // Ensure within bounds
            }
        }

        return timestamps;
    }, [frameCount, effectiveStart, effectiveEnd, effectiveDuration]);

    return (
        <div className="w-full h-full flex overflow-hidden bg-gray-900">
            {frameTimestamps.map((timestamp, i) => (
                <PreviewFrame
                    key={`${videoUrl}-${timestamp}-${i}`}
                    url={videoUrl}
                    timestamp={timestamp}
                />
            ))}
        </div>
    );
}
