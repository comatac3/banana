"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import * as storage from "@/utils/storage";
import LanguageToggle from "@/components/LanguageToggle";

// Model configurations with their specific settings
const MODELS = [
    {
        id: 'veo3_fast',
        name: 'Veo3 Fast',
        description: 'Google Veo3 - Fast image-to-video generation',
        cost: 6,
        badge: 'FAST',
        settings: {
            aspectRatios: ['16:9', '9:16', '1:1'],
            durations: [8],
            defaultAspectRatio: '16:9',
            defaultDuration: 8,
        }
    },
    {
        id: 'veo3',
        name: 'Veo3 Quality',
        description: 'Google Veo3 - High quality 1080P HD',
        cost: 10,
        badge: 'HD',
        settings: {
            aspectRatios: ['16:9', '9:16', '1:1'],
            durations: [8],
            defaultAspectRatio: '16:9',
            defaultDuration: 8,
        }
    },
    {
        id: 'runway',
        name: 'Runway Gen-3',
        description: 'Runway AI - Professional video generation',
        cost: 8,
        badge: 'PRO',
        settings: {
            aspectRatios: ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'],
            durations: [5, 10],
            resolutions: ['720p', '1080p'],
            defaultAspectRatio: '16:9',
            defaultDuration: 5,
            defaultResolution: '720p',
            // Note: 1080p cannot be used with 10s duration
        }
    },
    {
        id: 'kling',
        name: 'Kling 2.1 Master',
        description: 'Kuaishou Kling - High quality video generation',
        cost: 8,
        badge: 'NEW',
        settings: {
            aspectRatios: ['16:9', '9:16', '1:1'],
            durations: [5, 10],
            defaultAspectRatio: '16:9',
            defaultDuration: 5,
        }
    },
    {
        id: 'seedance',
        name: 'Seedance V1 Pro',
        description: 'ByteDance - Fast image-to-video (requires image)',
        cost: 6,
        badge: 'FAST',
        requiresImage: true,
        settings: {
            aspectRatios: ['16:9'],
            durations: [5, 10],
            resolutions: ['720p', '1080p'],
            defaultAspectRatio: '16:9',
            defaultDuration: 5,
            defaultResolution: '720p',
        }
    },
    {
        id: 'grok',
        name: 'Grok Video',
        description: 'xAI Grok - Image-to-video generation (requires image)',
        cost: 8,
        badge: 'NEW',
        requiresImage: true,
        settings: {
            aspectRatios: ['16:9'],
            durations: [5],
            defaultAspectRatio: '16:9',
            defaultDuration: 5,
        }
    },
    {
        id: 'hailuo',
        name: 'Hailuo 2.3 Pro',
        description: 'Hailuo AI - High quality image-to-video (requires image)',
        cost: 8,
        badge: 'PRO',
        requiresImage: true,
        settings: {
            aspectRatios: ['16:9'],
            durations: [6, 10],
            resolutions: ['768P', '1080P'],
            defaultAspectRatio: '16:9',
            defaultDuration: 6,
            defaultResolution: '768P',
        }
    },
];

export default function VideoPage() {
    const router = useRouter();
    const supabase = createClient();
    const { t } = useLanguage();

    const [user, setUser] = useState<any>(null);
    const [credits, setCredits] = useState<number | null>(null);
    const [sourceImage, setSourceImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedModel, setSelectedModel] = useState(MODELS[0]);
    const [prompt, setPrompt] = useState("");
    const [aspectRatio, setAspectRatio] = useState("16:9");
    const [duration, setDuration] = useState(8);
    const [resolution, setResolution] = useState("720p");
    const [isGenerating, setIsGenerating] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [errorDetails, setErrorDetails] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

            // Load source image (optional - user can upload on this page)
            const savedImage = await storage.getItem<string>("banana_video_source");
            if (savedImage) {
                setSourceImage(savedImage);
            }
            setLoading(false);
        };

        init();
    }, [router, supabase]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        await storage.removeItem("banana_composition_data");
        await storage.removeItem("banana_video_source");
        window.location.href = "/";
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            setSourceImage(base64);
            await storage.setItem("banana_video_source", base64);
        };
        reader.readAsDataURL(file);

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Update settings when model changes
    const handleModelChange = (model: typeof MODELS[0]) => {
        setSelectedModel(model);
        // Reset to model defaults
        if (model.settings.defaultAspectRatio) {
            setAspectRatio(model.settings.defaultAspectRatio);
        }
        if (model.settings.defaultDuration) {
            setDuration(model.settings.defaultDuration);
        }
        if (model.settings.defaultResolution) {
            setResolution(model.settings.defaultResolution);
        }
    };

    // Check if current settings are valid for Runway (1080p + 10s not allowed)
    const isRunwaySettingInvalid = selectedModel.id === 'runway' && resolution === '1080p' && duration === 10;
    // Check if current settings are valid for Hailuo (1080P + 10s not allowed)
    const isHailuoSettingInvalid = selectedModel.id === 'hailuo' && resolution === '1080P' && duration === 10;

    const handleGenerateVideo = async () => {
        if (!user || !credits || credits < selectedModel.cost) {
            alert("Insufficient credits!");
            return;
        }

        setIsGenerating(true);
        setVideoUrl(null);
        setErrorMessage(null);
        setErrorDetails(null);

        try {
            const response = await fetch("/api/video/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceImage,
                    prompt,
                    model: selectedModel.id,
                    aspectRatio,
                    duration,
                    resolution,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                const error = new Error(data.error || "Failed to generate video") as any;
                error.details = data.details;
                throw error;
            }

            // If we got a video URL directly
            if (data.videoUrl) {
                setVideoUrl(data.videoUrl);
                setCredits(data.credits ?? (credits - selectedModel.cost));
            }
            // If generation is async, start polling
            else if (data.operationId) {
                await pollForVideo(data.operationId);
            }
        } catch (error: any) {
            console.error("Video generation error:", error);
            setErrorMessage(error.message || "Failed to generate video");
            setErrorDetails(error.details || null);
        } finally {
            setIsGenerating(false);
        }
    };

    const pollForVideo = async (operationId: string) => {
        const maxAttempts = 120; // 10 minutes max (5 second intervals)
        let attempts = 0;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

            try {
                const response = await fetch(`/api/video/status?operationId=${encodeURIComponent(operationId)}&model=${selectedModel.id}`);
                const data = await response.json();

                if (data.status === "completed" && data.videoUrl) {
                    setVideoUrl(data.videoUrl);
                    // Refresh credits
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('credits')
                        .eq('id', user.id)
                        .single();
                    setCredits(profile?.credits ?? 0);
                    return;
                } else if (data.status === "failed") {
                    throw new Error(data.error || data.details || "Video generation failed");
                }
                // If still processing, continue polling
            } catch (error: any) {
                console.error("Polling error:", error);
                throw error;
            }

            attempts++;
        }

        throw new Error("Video generation timed out. Please try again.");
    };

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-white">
            <div className="text-center">
                <div className="text-6xl animate-bounce mb-4">🍌</div>
                <div className="text-xl font-black">LOADING VIDEO STUDIO...</div>
            </div>
        </div>
    );

    if (!user) return null;

    return (
        <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b-4 border-black p-4 flex justify-between items-center shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push("/studio")}
                        className="font-black hover:underline flex items-center gap-2"
                    >
                        ← Back to Studio
                    </button>
                    <h1 className="text-2xl font-black hidden sm:block">VIDEO STUDIO 🎥</h1>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-full border-2 border-black font-bold">
                        <span>🍌 {credits} Credits</span>
                    </div>
                    <button
                        onClick={() => router.push("/features")}
                        className="bg-gradient-to-r from-yellow-100 to-orange-100 hover:from-yellow-200 hover:to-orange-200 text-orange-600 px-3 py-1 rounded-md text-xs font-black border-2 border-transparent hover:border-orange-300 transition-all uppercase tracking-wider"
                    >
                        Features
                    </button>
                    <button
                        onClick={() => router.push("/asset")}
                        className="bg-purple-100 hover:bg-purple-200 text-purple-600 px-3 py-1 rounded-md text-xs font-black border-2 border-transparent hover:border-purple-300 transition-all uppercase tracking-wider hidden sm:block"
                    >
                        Assets
                    </button>
                    <LanguageToggle />
                    <button
                        onClick={handleSignOut}
                        className="bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 px-3 py-1 rounded-md text-xs font-black border-2 border-transparent hover:border-red-200 transition-all uppercase tracking-wider"
                    >
                        Out
                    </button>
                </div>
            </div>

            <main className="flex-1 overflow-hidden p-4 sm:p-6 max-w-[1600px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                {/* Left Column: Controls - Scrollable */}
                <div className="lg:col-span-4 h-full flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-4">
                    {/* Source Image Preview */}
                    <div className="bg-white p-4 rounded-xl border-2 border-black shadow-hard">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="font-black text-lg">Source Image</h2>
                            {sourceImage && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                    Change
                                </button>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                        />
                        <div
                            className={`aspect-video bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 relative ${!sourceImage ? 'cursor-pointer hover:bg-gray-200 hover:border-gray-400 transition-all' : ''}`}
                            onClick={() => !sourceImage && fileInputRef.current?.click()}
                        >
                            {sourceImage ? (
                                <img
                                    src={sourceImage}
                                    alt="Source"
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <p className="font-bold text-sm">Click to upload image</p>
                                    <p className="text-xs">or drag and drop</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Model Selection */}
                    <div className="bg-white p-4 rounded-xl border-2 border-black shadow-hard">
                        <h2 className="font-black text-lg mb-4">Select AI Model</h2>
                        <div className="grid grid-cols-1 gap-3">
                            {MODELS.map(model => (
                                <button
                                    key={model.id}
                                    onClick={() => handleModelChange(model)}
                                    className={`
                    p-3 rounded-lg border-2 text-left transition-all
                    ${selectedModel.id === model.id
                                            ? 'bg-banana border-black shadow-hard translate-x-1'
                                            : 'bg-white border-gray-200 hover:border-black hover:bg-gray-50'}
                  `}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-lg">{model.name}</span>
                                            {model.badge && (
                                                <span className={`text-white text-[10px] px-2 py-0.5 rounded-full font-black ${model.badge === 'FAST' ? 'bg-green-500' :
                                                    model.badge === 'HD' ? 'bg-purple-500' :
                                                        model.badge === 'PRO' ? 'bg-blue-500' :
                                                            model.badge === 'TOP' ? 'bg-gradient-to-r from-pink-500 to-red-500' : 'bg-gray-500'
                                                    }`}>
                                                    {model.badge}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs font-bold bg-black text-white px-2 py-0.5 rounded-full">
                                            {model.cost} 🍌
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600">{model.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Prompt Input */}
                    <div className="bg-white p-4 rounded-xl border-2 border-black shadow-hard">
                        <h2 className="font-black text-lg mb-2">Video Prompt</h2>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe the video motion and style (e.g., 'Camera slowly zooms in, cinematic lighting, gentle wind blowing hair')..."
                            className="w-full h-24 p-3 border-2 border-gray-300 rounded-lg focus:border-black focus:ring-0 resize-none font-medium"
                        />
                    </div>

                    {/* Video Settings - Dynamic per model */}
                    <div className="bg-white p-4 rounded-xl border-2 border-black shadow-hard">
                        <h2 className="font-black text-lg mb-4">Video Settings</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {/* Aspect Ratio - Only for Veo3 and Runway */}
                            {selectedModel.settings.aspectRatios && (
                                <div>
                                    <label className="block text-sm font-bold mb-2">Aspect Ratio</label>
                                    <select
                                        value={aspectRatio}
                                        onChange={(e) => setAspectRatio(e.target.value)}
                                        className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-black focus:ring-0 font-medium"
                                    >
                                        {selectedModel.settings.aspectRatios.map((ratio: string) => (
                                            <option key={ratio} value={ratio}>
                                                {ratio} {ratio === '16:9' ? '(Landscape)' : ratio === '9:16' ? '(Portrait)' : ratio === '1:1' ? '(Square)' : ratio === '21:9' ? '(Ultrawide)' : ratio === '4:3' ? '(Standard)' : ratio === '3:4' ? '(Tall)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Resolution - Only for Runway and Seedance */}
                            {selectedModel.settings.resolutions && (
                                <div>
                                    <label className="block text-sm font-bold mb-2">Resolution</label>
                                    <select
                                        value={resolution}
                                        onChange={(e) => setResolution(e.target.value)}
                                        className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-black focus:ring-0 font-medium"
                                    >
                                        {selectedModel.settings.resolutions.map((res: string) => (
                                            <option key={res} value={res}>
                                                {res} {res === '1080p' ? '(HD)' : '(Standard)'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Duration */}
                            <div>
                                <label className="block text-sm font-bold mb-2">Duration</label>
                                <select
                                    value={duration}
                                    onChange={(e) => setDuration(Number(e.target.value))}
                                    className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-black focus:ring-0 font-medium"
                                >
                                    {selectedModel.settings.durations.map((dur: number) => (
                                        <option key={dur} value={dur}>{dur} seconds</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Warning for Runway 1080p + 10s */}
                        {isRunwaySettingInvalid && (
                            <div className="mt-3 p-2 bg-yellow-100 border-2 border-yellow-400 rounded-lg text-sm font-bold text-yellow-800">
                                ⚠️ Runway: 1080p resolution cannot be used with 10s duration
                            </div>
                        )}
                        {/* Warning for Hailuo 1080P + 10s */}
                        {isHailuoSettingInvalid && (
                            <div className="mt-3 p-2 bg-yellow-100 border-2 border-yellow-400 rounded-lg text-sm font-bold text-yellow-800">
                                ⚠️ Hailuo: 1080P resolution cannot be used with 10s duration
                            </div>
                        )}
                    </div>

                    </div>

                    {/* Generate Button - Fixed at bottom */}
                    <div className="shrink-0 pt-4 bg-gray-50">
                        <button
                            onClick={handleGenerateVideo}
                            disabled={isGenerating || !sourceImage || (credits || 0) < selectedModel.cost || isRunwaySettingInvalid || isHailuoSettingInvalid}
                            className="w-full btn-pop bg-pop-purple text-white py-4 rounded-xl text-xl font-black shadow-hard hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isGenerating ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin">🍌</span> Generating...
                                </span>
                            ) : !sourceImage ? (
                                "Upload an image first"
                            ) : (
                                `Generate Video (${selectedModel.cost} 🍌)`
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Column: Result - Fixed Height */}
                <div className="lg:col-span-8 h-full flex flex-col min-h-0">
                    <div className="bg-white p-4 sm:p-6 rounded-xl border-4 border-black shadow-hard-lg flex flex-col h-full">
                        <h2 className="font-black text-2xl mb-4 text-center shrink-0">Video Result</h2>

                        <div className="flex-1 bg-black rounded-xl overflow-hidden border-2 border-gray-800 relative flex items-center justify-center min-h-0">
                            {videoUrl ? (
                                <video
                                    src={videoUrl}
                                    controls
                                    autoPlay
                                    loop
                                    className="w-full h-full object-contain"
                                />
                            ) : errorMessage ? (
                                <div className="text-center p-8">
                                    <div className="text-6xl mb-4">⚠️</div>
                                    <p className="font-bold text-lg text-red-400 mb-2">
                                        {errorMessage}
                                    </p>
                                    {errorDetails && (
                                        <p className="text-sm text-gray-400 max-w-md mx-auto">
                                            {errorDetails}
                                        </p>
                                    )}
                                    <button
                                        onClick={() => { setErrorMessage(null); setErrorDetails(null); }}
                                        className="mt-4 text-sm text-gray-500 hover:text-white underline"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            ) : isGenerating ? (
                                <div className="text-center p-8 relative">
                                    {/* Magic sparkles background */}
                                    <div className="absolute inset-0 overflow-hidden">
                                        {[...Array(20)].map((_, i) => (
                                            <div
                                                key={i}
                                                className="absolute animate-sparkle"
                                                style={{
                                                    left: `${Math.random() * 100}%`,
                                                    top: `${Math.random() * 100}%`,
                                                    animationDelay: `${Math.random() * 3}s`,
                                                    animationDuration: `${2 + Math.random() * 2}s`,
                                                }}
                                            >
                                                <span className="text-yellow-400 text-xl">✨</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Glowing magic circle */}
                                    <div className="relative z-10">
                                        <div className="relative inline-block">
                                            {/* Outer glow ring */}
                                            <div className="absolute inset-0 animate-ping-slow">
                                                <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 opacity-30 blur-xl"></div>
                                            </div>
                                            {/* Rotating ring */}
                                            <div className="w-32 h-32 mx-auto rounded-full border-4 border-transparent bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 animate-spin-slow p-1">
                                                <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                                                    <span className="text-5xl animate-bounce-slow">🎬</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Magic wand effect */}
                                        <div className="mt-6 flex justify-center gap-1">
                                            {[...Array(5)].map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="w-2 h-8 bg-gradient-to-t from-purple-500 to-pink-400 rounded-full animate-wave"
                                                    style={{ animationDelay: `${i * 0.15}s` }}
                                                ></div>
                                            ))}
                                        </div>

                                        <p className="font-black text-xl mt-6 bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent animate-pulse">
                                            Creating magic...
                                        </p>
                                        <p className="text-gray-500 text-sm mt-2 animate-pulse">
                                            This may take a few minutes
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 p-8">
                                    <div className="text-6xl mb-4 opacity-20">🎬</div>
                                    <p className="font-bold text-xl opacity-50">
                                        Select a model and click Generate
                                    </p>
                                </div>
                            )}
                        </div>

                        {videoUrl && (
                            <div className="mt-6 flex gap-4 shrink-0">
                                <a
                                    href={videoUrl}
                                    download="banana-video.mp4"
                                    className="flex-1 btn-pop bg-pop-green text-white py-3 rounded-xl font-black text-center shadow-hard"
                                >
                                    Download Video 💾
                                </a>
                                <button
                                    onClick={() => setVideoUrl(null)}
                                    className="px-6 py-3 font-bold text-gray-500 hover:text-black"
                                >
                                    Clear
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
