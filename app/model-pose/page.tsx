"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import LanguageToggle from "@/components/LanguageToggle";

const POSE_COST = 2;

// Pose categories with icons
const POSE_CATEGORIES = [
  { id: 'standing', name: 'Standing', icon: '🧍' },
  { id: 'sitting', name: 'Sitting', icon: '🪑' },
  { id: 'action', name: 'Action', icon: '🏃' },
  { id: 'gesture', name: 'Gesture', icon: '👋' },
  { id: 'professional', name: 'Professional', icon: '💼' },
  { id: 'social', name: 'Social Media', icon: '📱' },
  { id: 'fashion', name: 'Fashion', icon: '👗' },
];

// Poses grouped by category
const POSES: Record<string, { id: string; name: string; icon: string }[]> = {
  standing: [
    { id: 'standing-casual', name: 'Casual', icon: '😊' },
    { id: 'standing-confident', name: 'Confident', icon: '💪' },
    { id: 'standing-crossed-arms', name: 'Arms Crossed', icon: '🤨' },
    { id: 'standing-lean', name: 'Leaning', icon: '😎' },
  ],
  sitting: [
    { id: 'sitting-casual', name: 'Casual', icon: '🙂' },
    { id: 'sitting-professional', name: 'Professional', icon: '👔' },
    { id: 'sitting-floor', name: 'Floor', icon: '🧘' },
    { id: 'sitting-couch', name: 'Couch', icon: '🛋️' },
  ],
  action: [
    { id: 'walking', name: 'Walking', icon: '🚶' },
    { id: 'running', name: 'Running', icon: '🏃' },
    { id: 'jumping', name: 'Jumping', icon: '⬆️' },
    { id: 'dancing', name: 'Dancing', icon: '💃' },
  ],
  gesture: [
    { id: 'waving', name: 'Waving', icon: '👋' },
    { id: 'thumbs-up', name: 'Thumbs Up', icon: '👍' },
    { id: 'peace-sign', name: 'Peace Sign', icon: '✌️' },
    { id: 'pointing', name: 'Pointing', icon: '👉' },
  ],
  professional: [
    { id: 'presenting', name: 'Presenting', icon: '🎤' },
    { id: 'thinking', name: 'Thinking', icon: '🤔' },
    { id: 'working', name: 'Working', icon: '💻' },
    { id: 'holding-product', name: 'Hold Product', icon: '📦' },
  ],
  social: [
    { id: 'selfie', name: 'Selfie', icon: '🤳' },
    { id: 'mirror-selfie', name: 'Mirror Selfie', icon: '🪞' },
    { id: 'candid', name: 'Candid', icon: '📸' },
    { id: 'laughing', name: 'Laughing', icon: '😂' },
  ],
  fashion: [
    { id: 'model-pose', name: 'Model Pose', icon: '🌟' },
    { id: 'runway', name: 'Runway', icon: '👠' },
    { id: 'casual-fashion', name: 'Casual', icon: '👕' },
    { id: 'street-style', name: 'Street Style', icon: '🏙️' },
  ],
};

export default function ModelPostPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('standing');
  const [selectedPose, setSelectedPose] = useState<string | null>(null);
  const [customPose, setCustomPose] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'reference') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (type === 'avatar') {
        setAvatarImage(base64);
      } else {
        setReferenceImage(base64);
      }
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  };

  const handleGenerate = async () => {
    if (!avatarImage) {
      setError("Please upload an avatar image first");
      return;
    }

    if (!selectedPose && !customPose.trim()) {
      setError("Please select a pose or enter a custom pose");
      return;
    }

    if (!credits || credits < POSE_COST) {
      setError("Insufficient credits");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/model-pose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarImage,
          poseId: selectedPose,
          customPose: customPose.trim() || undefined,
          referenceImage: referenceImage || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Generation failed");
      }

      // Add to carousel at the beginning
      setGeneratedImages(prev => [data.generatedImage, ...prev]);
      setCurrentImageIndex(0);
      setCredits(data.credits);
    } catch (err: any) {
      setError(err.message || "Failed to generate");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseAsAvatar = () => {
    const currentImage = generatedImages[currentImageIndex];
    if (currentImage) {
      setAvatarImage(currentImage);
    }
  };

  const handleDeleteImage = (index: number) => {
    setGeneratedImages(prev => prev.filter((_, i) => i !== index));
    if (currentImageIndex >= generatedImages.length - 1) {
      setCurrentImageIndex(Math.max(0, generatedImages.length - 2));
    }
  };

  const handlePrevImage = () => {
    setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : generatedImages.length - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => (prev < generatedImages.length - 1 ? prev + 1 : 0));
  };

  const handleDownload = () => {
    const currentImage = generatedImages[currentImageIndex];
    if (!currentImage) return;
    const link = document.createElement('a');
    link.href = currentImage;
    link.download = `model-pose-${Date.now()}.png`;
    link.click();
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="text-6xl animate-bounce mb-4">🧍</div>
        <div className="text-xl font-black">LOADING MODEL POSE...</div>
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
            onClick={() => router.push("/studio")}
            className="font-black hover:underline flex items-center gap-2"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-black hidden sm:block">MODEL POSE 🧍</h1>
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

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Input */}
          <div className="space-y-6">
            {/* Avatar Upload */}
            <div className="bg-white p-6 rounded-xl border-2 border-black shadow-hard">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-black text-xl">1. Upload Avatar</h2>
                {avatarImage && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm font-bold text-blue-600 hover:underline"
                  >
                    Change
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'avatar')}
                className="hidden"
              />
              <div
                onClick={() => !avatarImage && fileInputRef.current?.click()}
                className={`aspect-square max-w-sm mx-auto bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 overflow-hidden ${!avatarImage ? 'cursor-pointer hover:bg-gray-200 hover:border-gray-400' : ''}`}
              >
                {avatarImage ? (
                  <img src={avatarImage} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <span className="text-6xl mb-4">🧍</span>
                    <p className="font-bold">Click to upload avatar</p>
                    <p className="text-sm">PNG, JPG up to 10MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pose Selection */}
            <div className="bg-white p-6 rounded-xl border-2 border-black shadow-hard">
              <h2 className="font-black text-xl mb-4">2. Select Pose</h2>

              {/* Category Tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                {POSE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedPose(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-banana border-2 border-black shadow-hard'
                        : 'bg-gray-100 border-2 border-transparent hover:border-gray-300'
                    }`}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>

              {/* Pose Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {POSES[selectedCategory]?.map((pose) => (
                  <button
                    key={pose.id}
                    onClick={() => {
                      setSelectedPose(pose.id);
                      setCustomPose('');
                    }}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      selectedPose === pose.id
                        ? 'bg-pop-purple text-white border-black shadow-hard scale-105'
                        : 'bg-white border-gray-200 hover:border-black hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-2xl block mb-1">{pose.icon}</span>
                    <span className="font-bold text-sm">{pose.name}</span>
                  </button>
                ))}
              </div>

              {/* Custom Pose Input */}
              <div className="mt-4">
                <label className="block text-sm font-bold mb-2 text-gray-600">
                  Or describe custom pose:
                </label>
                <textarea
                  value={customPose}
                  onChange={(e) => {
                    setCustomPose(e.target.value);
                    if (e.target.value) setSelectedPose(null);
                  }}
                  placeholder="e.g., sitting on a beach chair, holding a drink, looking relaxed..."
                  className="w-full h-20 p-3 border-2 border-gray-300 rounded-lg focus:border-black focus:ring-0 resize-none"
                />
              </div>
            </div>

            {/* Reference Image (Optional) */}
            <div className="bg-white p-6 rounded-xl border-2 border-black shadow-hard">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-black text-xl">3. Pose Reference (Optional)</h2>
                {referenceImage && (
                  <button
                    onClick={() => setReferenceImage(null)}
                    className="text-sm font-bold text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={refInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'reference')}
                className="hidden"
              />
              <div
                onClick={() => refInputRef.current?.click()}
                className="aspect-video max-w-xs mx-auto bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 overflow-hidden cursor-pointer hover:bg-gray-200 hover:border-gray-400"
              >
                {referenceImage ? (
                  <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <span className="text-4xl mb-2">📷</span>
                    <p className="font-bold text-sm">Upload pose reference</p>
                    <p className="text-xs">AI will match this pose</p>
                  </div>
                )}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !avatarImage || (!selectedPose && !customPose.trim()) || (credits || 0) < POSE_COST}
              className="w-full btn-pop bg-pop-purple text-white py-4 rounded-xl text-xl font-black shadow-hard hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">🧍</span> Generating Pose...
                </span>
              ) : !avatarImage ? (
                "Upload avatar first"
              ) : !selectedPose && !customPose.trim() ? (
                "Select a pose"
              ) : (
                `Generate Pose (${POSE_COST} 🍌)`
              )}
            </button>

            {error && (
              <div className="bg-red-100 border-2 border-red-400 text-red-700 p-4 rounded-xl font-bold">
                {error}
              </div>
            )}
          </div>

          {/* Right Column - Result Carousel */}
          <div className="bg-white p-6 rounded-xl border-4 border-black shadow-hard-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-black text-2xl">Result</h2>
              {generatedImages.length > 0 && (
                <span className="text-sm font-bold bg-gray-100 px-3 py-1 rounded-full">
                  {currentImageIndex + 1} / {generatedImages.length}
                </span>
              )}
            </div>

            <div className="aspect-square bg-black rounded-xl overflow-hidden border-2 border-gray-800 relative flex items-center justify-center">
              {generatedImages.length > 0 ? (
                <>
                  <img
                    src={generatedImages[currentImageIndex]}
                    alt={`Generated ${currentImageIndex + 1}`}
                    className="w-full h-full object-contain"
                  />

                  {/* Navigation Arrows */}
                  {generatedImages.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevImage}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-black font-black text-xl transition-all hover:scale-110"
                      >
                        ←
                      </button>
                      <button
                        onClick={handleNextImage}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-black font-black text-xl transition-all hover:scale-110"
                      >
                        →
                      </button>
                    </>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteImage(currentImageIndex)}
                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg font-bold text-sm transition-all hover:scale-110"
                  >
                    ×
                  </button>
                </>
              ) : isGenerating ? (
                <div className="text-center p-8 relative">
                  {/* Magic sparkles */}
                  <div className="absolute inset-0 overflow-hidden">
                    {[...Array(15)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute animate-sparkle"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `${Math.random() * 100}%`,
                          animationDelay: `${Math.random() * 3}s`,
                        }}
                      >
                        <span className="text-yellow-400 text-xl">✨</span>
                      </div>
                    ))}
                  </div>

                  <div className="relative z-10">
                    <div className="w-24 h-24 mx-auto rounded-full border-4 border-transparent bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 animate-spin-slow p-1">
                      <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                        <span className="text-4xl animate-bounce-slow">🧍</span>
                      </div>
                    </div>
                    <p className="font-black text-xl mt-6 bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent animate-pulse">
                      Transforming pose...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 p-8">
                  <span className="text-6xl block mb-4 opacity-20">🖼️</span>
                  <p className="font-bold text-xl opacity-50">
                    Generated poses will appear here
                  </p>
                </div>
              )}
            </div>

            {/* Thumbnail Strip */}
            {generatedImages.length > 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {generatedImages.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      index === currentImageIndex
                        ? 'border-pop-purple shadow-hard scale-105'
                        : 'border-gray-300 hover:border-gray-500 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`Thumb ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {generatedImages.length > 0 && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleDownload}
                  className="flex-1 btn-pop bg-pop-green text-white py-3 rounded-xl font-black shadow-hard"
                >
                  Download 💾
                </button>
                <button
                  onClick={handleUseAsAvatar}
                  className="flex-1 btn-pop bg-pop-blue text-white py-3 rounded-xl font-black shadow-hard"
                >
                  Use as Avatar 🔄
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
