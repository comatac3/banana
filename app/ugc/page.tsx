"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

const UGC_STYLES = [
    {
        id: 'casual_review',
        name: 'Casual Review',
        description: 'Natural product review like talking to a friend',
        icon: '💬',
    },
    {
        id: 'unboxing',
        name: 'Unboxing',
        description: 'Excited first impression and product reveal',
        icon: '📦',
    },
    {
        id: 'before_after',
        name: 'Before/After',
        description: 'Show transformation or results',
        icon: '✨',
    },
    {
        id: 'tutorial',
        name: 'How-To Tutorial',
        description: 'Step-by-step product usage guide',
        icon: '👆',
    },
];

export default function UGCPage() {
    const router = useRouter();
    const supabase = createClient();
    const { t } = useLanguage();

    const [user, setUser] = useState<any>(null);
    const [credits, setCredits] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    const [productImage, setProductImage] = useState<string | null>(null);
    const [script, setScript] = useState("");
    const [selectedStyle, setSelectedStyle] = useState(UGC_STYLES[0]);
    const [duration, setDuration] = useState(15);
    const [language, setLanguage] = useState("th");
    const [veoModel, setVeoModel] = useState("veo3");

    // Calculate cost based on selected veo model
    const getModelCost = () => {
        return veoModel === "veo3_fast" ? 6 : 10;
    };

    const [isGenerating, setIsGenerating] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

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
            setLoading(false);
        };

        init();
    }, [router, supabase]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        window.location.href = "/";
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            setProductImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleGenerateUGC = async () => {
        const modelCost = getModelCost();
        if (!user || !credits || credits < modelCost) {
            alert("Insufficient credits!");
            return;
        }

        if (!productImage) {
            alert("Please upload a product image!");
            return;
        }

        if (!script.trim()) {
            alert("Please enter a script or talking points!");
            return;
        }

        setIsGenerating(true);
        setVideoUrl(null);
        setErrorMessage(null);

        try {
            // Generate UGC-style prompt based on selected style and script
            let ugcPrompt = "";
            switch (selectedStyle.id) {
                case 'casual_review':
                    ugcPrompt = `UGC style video: Natural person holding phone, casual product review. ${script}. Handheld camera, authentic feel, direct to camera, indoor natural lighting.`;
                    break;
                case 'unboxing':
                    ugcPrompt = `UGC style video: Excited unboxing and first impression. ${script}. Hands opening package, revealing product, genuine excitement, handheld phone camera.`;
                    break;
                case 'before_after':
                    ugcPrompt = `UGC style video: Before and after transformation showcase. ${script}. Comparison shots, results demonstration, authentic testimonial style.`;
                    break;
                case 'tutorial':
                    ugcPrompt = `UGC style video: Step-by-step tutorial showing product usage. ${script}. Close-up hands demonstrating, clear instructions, helpful and friendly tone.`;
                    break;
            }

            const response = await fetch("/api/video/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceImage: productImage,
                    prompt: ugcPrompt,
                    model: veoModel,
                    aspectRatio: "9:16", // Vertical for mobile/social
                    duration: 8,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to generate UGC video");
            }

            // If we got a video URL directly
            if (data.videoUrl) {
                setVideoUrl(data.videoUrl);
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('credits')
                    .eq('id', user.id)
                    .single();
                setCredits(profile?.credits ?? 0);
            }
            // If generation is async, start polling
            else if (data.operationId) {
                await pollForVideo(data.operationId);
            }
        } catch (error: any) {
            console.error("UGC generation error:", error);
            setErrorMessage(error.message || "Failed to generate UGC video");
        } finally {
            setIsGenerating(false);
        }
    };

    const pollForVideo = async (operationId: string) => {
        const maxAttempts = 120;
        let attempts = 0;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000));

            try {
                const response = await fetch(`/api/video/status?operationId=${encodeURIComponent(operationId)}&model=${veoModel}`);
                const data = await response.json();

                if (data.status === "completed" && data.videoUrl) {
                    setVideoUrl(data.videoUrl);
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('credits')
                        .eq('id', user.id)
                        .single();
                    setCredits(profile?.credits ?? 0);
                    return;
                } else if (data.status === "failed") {
                    throw new Error(data.error || "Video generation failed");
                }
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
                <div className="text-xl font-black">LOADING UGC STUDIO...</div>
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
                    <h1 className="text-2xl font-black hidden sm:block">UGC STUDIO 🎥</h1>
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
                {/* Left Column: Controls */}
                <div className="lg:col-span-4 h-full flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-4">
                        {/* Info Banner */}
                        <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-4 rounded-xl border-2 border-purple-300">
                            <h3 className="font-black text-lg mb-2">🎬 UGC Videos</h3>
                            <p className="text-sm text-gray-700 mb-2">
                                Create authentic user-generated content style videos perfect for TikTok, Reels, and Lemon8!
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="bg-white px-2 py-1 rounded-full font-bold">✅ Authentic</span>
                                <span className="bg-white px-2 py-1 rounded-full font-bold">💬 Casual</span>
                                <span className="bg-white px-2 py-1 rounded-full font-bold">📱 Mobile-First</span>
                            </div>
                        </div>

                        {/* Product Image */}
                        <div className="bg-white p-4 rounded-xl border-2 border-black shadow-hard">
                            <div className="flex justify-between items-center mb-2">
                                <h2 className="font-black text-lg">Product Image</h2>
                                {productImage && (
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
                            {productImage ? (
                                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                                    <img src={productImage} alt="Product" className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full aspect-square bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-200 hover:border-gray-400 transition-all"
                                >
                                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <p className="font-bold text-sm">Upload Product</p>
                                </button>
                            )}
                        </div>

                        {/* UGC Style Selection */}
                        <div className="bg-white p-4 rounded-xl border-2 border-black shadow-hard">
                            <h2 className="font-black text-lg mb-4">UGC Style</h2>
                            <div className="grid grid-cols-1 gap-3">
                                {UGC_STYLES.map(style => (
                                    <button
                                        key={style.id}
                                        onClick={() => setSelectedStyle(style)}
                                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                                            selectedStyle.id === style.id
                                                ? 'bg-banana border-black shadow-hard'
                                                : 'bg-white border-gray-200 hover:border-black hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-2xl">{style.icon}</span>
                                            <span className="font-black">{style.name}</span>
                                        </div>
                                        <p className="text-sm text-gray-600">{style.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Script Input */}
                        <div className="bg-white p-4 rounded-xl border-2 border-black shadow-hard">
                            <h2 className="font-black text-lg mb-2">Script / Talking Points</h2>
                            <textarea
                                value={script}
                                onChange={(e) => setScript(e.target.value)}
                                placeholder="Enter what you want to say in the video...&#10;Example:&#10;- Hi everyone! I want to share this amazing product&#10;- I've been using it for 2 weeks and the results are incredible&#10;- The quality is really good and affordable&#10;- You should definitely try it!"
                                className="w-full h-32 p-3 border-2 border-gray-300 rounded-lg focus:border-black focus:ring-0 resize-none font-medium"
                            />
                        </div>

                        {/* Settings */}
                        <div className="bg-white p-4 rounded-xl border-2 border-black shadow-hard">
                            <h2 className="font-black text-lg mb-4">Settings</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold mb-2">Veo Model</label>
                                    <select
                                        value={veoModel}
                                        onChange={(e) => setVeoModel(e.target.value)}
                                        className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-black focus:ring-0 font-medium"
                                    >
                                        <option value="veo3_fast">Veo3 Fast (6 credits) - Faster generation</option>
                                        <option value="veo3">Veo3 Quality (10 credits) - Higher quality 1080P</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2">Duration</label>
                                    <div className="p-2 border-2 border-gray-200 rounded-lg bg-gray-50 font-medium text-gray-600">
                                        8 seconds (Veo3 fixed duration)
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2">Language</label>
                                    <select
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                        className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-black focus:ring-0 font-medium"
                                    >
                                        <option value="th">Thai (ไทย)</option>
                                        <option value="en">English</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Generate Button */}
                    <div className="shrink-0 pt-4 bg-gray-50">
                        <button
                            onClick={handleGenerateUGC}
                            disabled={isGenerating || !productImage || !script.trim() || (credits || 0) < getModelCost()}
                            className="w-full btn-pop bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl text-xl font-black shadow-hard hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isGenerating ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin">🎬</span> Generating UGC...
                                </span>
                            ) : !productImage ? (
                                "Upload Product Image First"
                            ) : !script.trim() ? (
                                "Enter Script First"
                            ) : (
                                `Generate UGC Video (${getModelCost()} 🍌)`
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Column: Preview */}
                <div className="lg:col-span-8 h-full flex flex-col min-h-0">
                    <div className="bg-white p-4 sm:p-6 rounded-xl border-4 border-black shadow-hard-lg flex flex-col h-full">
                        <h2 className="font-black text-2xl mb-4 text-center shrink-0">UGC Video Preview</h2>

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
                                    <div className="text-6xl mb-4">🚧</div>
                                    <p className="font-bold text-lg text-yellow-400 mb-2">
                                        {errorMessage}
                                    </p>
                                    <button
                                        onClick={() => setErrorMessage(null)}
                                        className="mt-4 text-sm text-gray-500 hover:text-white underline"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            ) : isGenerating ? (
                                <div className="text-center p-8">
                                    <div className="text-6xl animate-bounce mb-4">🎬</div>
                                    <p className="font-bold text-xl text-white mb-2">
                                        Creating your UGC video...
                                    </p>
                                    <p className="text-gray-400 text-sm">
                                        This may take a few moments
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 p-8">
                                    <div className="text-6xl mb-4 opacity-20">📱</div>
                                    <p className="font-bold text-xl opacity-50">
                                        Upload product & enter script to generate
                                    </p>
                                </div>
                            )}
                        </div>

                        {videoUrl && (
                            <div className="mt-6 flex gap-4 shrink-0">
                                <a
                                    href={videoUrl}
                                    download="ugc-video.mp4"
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
