"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/ImageUploader";
import ImageComposer from "@/components/ImageComposer";
import LanguageToggle from "@/components/LanguageToggle";
import Login from "@/components/Login";
import { useLanguage } from "@/contexts/LanguageContext";
import { createClient } from "@/utils/supabase/client";
import * as storage from "@/utils/storage";

export default function Home() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const isThai = language === 'th';
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [composedImage, setComposedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        // Use server-side API to get or create profile (bypasses RLS issues)
        try {
          const response = await fetch('/api/profile');
          const data = await response.json();

          if (response.ok && data.profile) {
            setCredits(data.profile.credits ?? 0);
          } else {
            console.error("Error fetching profile:", data.error);
            setCredits(0);
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
          setCredits(0);
        }
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setShowLogin(false); // Close login modal on successful login
        // Use server-side API to get or create profile (bypasses RLS issues)
        try {
          const response = await fetch('/api/profile');
          const data = await response.json();

          if (response.ok && data.profile) {
            setCredits(data.profile.credits ?? 0);
          } else {
            console.error("Error fetching profile (auth change):", data.error);
            setCredits(0);
          }
        } catch (error) {
          console.error("Error fetching profile (auth change):", error);
          setCredits(0);
        }
      } else {
        setCredits(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleImageUpload = (setter: (img: string | null) => void) => {
    return (image: string | null) => {
      if (!user) {
        setShowLogin(true);
        return;
      }
      setter(image);
    };
  };

  const handleGenerateComposition = async () => { // Renamed from handleGenerate in the edit, keeping original name
    if (!user) {
      setShowLogin(true);
      return;
    }

    if (!avatarImage || !productImage) {
      setError("Please upload both images"); // Added specific error message
      return;
    }

    if (credits !== null && credits < 1) {
      setError("Not enough credits! 🍌");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Save images for preview page
      await Promise.all([
        storage.setItem("banana_preview_avatar", avatarImage),
        storage.setItem("banana_preview_product", productImage),
      ]);

      // Go to preview page for AI analysis
      router.push("/preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setComposedImage(null);
    setError(null);
  };

  const handleSignOut = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    // Force reload after 1 second max
    const timeoutId = setTimeout(() => {
      window.location.reload();
    }, 1000);

    try {
      await supabase.auth.signOut();
      setUser(null);
      setCredits(null);
      setAvatarImage(null);
      setProductImage(null);
      clearTimeout(timeoutId);
      window.location.reload();
    } catch (error) {
      console.error("Error signing out:", error);
      window.location.reload();
    }
  };



  return (
    <div className={`min-h-screen p-2 sm:p-4 lg:p-8 relative overflow-auto flex flex-col font-['Bangers'] ${isThai ? 'font-mitr' : ''}`}>
      {showLogin && (
        <div className="fixed inset-0 z-[60]" onClick={() => setShowLogin(false)}>
          <div onClick={e => e.stopPropagation()}>
            <Login />
          </div>
        </div>
      )}

      {/* Language Toggle */}
      <div className="absolute top-2 lg:top-4 right-2 lg:right-4 z-50 flex items-center gap-2 lg:gap-4">
        {user ? (
          <div className="flex items-center gap-2 lg:gap-3 bg-white px-2 lg:px-3 py-1 lg:py-1.5 rounded-full border-2 border-black shadow-hard z-[100] text-xs lg:text-sm">
            <span className={`font-bold whitespace-nowrap ${isThai ? 'font-mitr' : ''}`}>🍌 {credits}</span>
            <button
              onClick={() => router.push("/asset")}
              className="bg-purple-100 hover:bg-purple-200 text-purple-600 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-md text-[10px] lg:text-xs font-black border-2 border-transparent hover:border-purple-300 transition-all uppercase tracking-wider"
            >
              Assets
            </button>
            <button
              onClick={handleSignOut}
              className="bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-md text-[10px] lg:text-xs font-black border-2 border-transparent hover:border-red-200 transition-all uppercase tracking-wider"
            >
              Out
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowLogin(true)}
            className="bg-white px-4 py-1.5 rounded-full border-2 border-black shadow-hard font-bold text-sm hover:-translate-y-0.5 transition-transform"
          >
            Login
          </button>
        )}
        <LanguageToggle />
      </div>

      {/* Hero Section */}
      <header className="max-w-5xl mx-auto text-center mb-6 sm:mb-8 lg:mb-8 relative z-10 flex-shrink-0 mt-12 sm:mt-0">
        <div className="inline-block bg-banana px-3 sm:px-6 py-1 sm:py-2 border-bold shadow-hard mb-2 sm:mb-6 rotate-2">
          <span className={`font-bold text-[10px] sm:text-lg tracking-widest ${isThai ? 'font-mitr' : ''}`}>{t.poweredBy}</span>
        </div>

        <h1 className={`text-2xl sm:text-5xl lg:text-7xl font-black mb-2 sm:mb-4 leading-tight text-outline text-white drop-shadow-xl ${isThai ? 'font-mitr tracking-normal' : ''}`}>
          {t.cookUp}<br />
          <span className="text-banana text-outline">{t.winningAds}</span>
        </h1>

        <p className={`text-xs sm:text-lg lg:text-xl font-bold text-gray-800 max-w-2xl mx-auto bg-white/80 backdrop-blur-sm p-2 sm:p-3 rounded-xl border-2 border-black shadow-hard ${isThai ? 'font-mitr tracking-normal' : ''}`}>
          {t.tagline}
          {" "}{t.noDesignSkills} <span className="text-pop-pink">{t.noProblem}</span>
        </p>
      </header>

      <main className="max-w-6xl mx-auto relative z-10 flex-1 flex flex-col justify-center min-h-0">
        <div className="space-y-4 lg:space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 lg:gap-8 relative">
            {/* Step 1 */}
            <div className="relative group w-full md:w-1/2 max-w-sm lg:max-w-md">
              <div className="absolute -top-3 lg:-top-5 -left-3 lg:-left-5 bg-pop-pink text-white w-10 h-10 lg:w-14 lg:h-14 flex items-center justify-center rounded-full border-bold shadow-hard z-20 text-xl lg:text-2xl font-black rotate-12 group-hover:rotate-0 transition-transform">
                1
              </div>
              <div className="card-pop p-3 lg:p-6 bg-white rotate-1 group-hover:rotate-0 transition-transform">
                <h2 className="text-lg lg:text-2xl font-black mb-2 lg:mb-4 text-center bg-pop-blue text-white inline-block px-2 lg:px-3 py-1 border-bold shadow-hard -rotate-2">
                  {t.theTalent}
                </h2>
                <ImageUploader
                  label={t.dropAvatar}
                  image={avatarImage}
                  onImageUpload={handleImageUpload(setAvatarImage)}
                  exampleImage="https://images.unsplash.com/photo-1539008835657-9e8e9680c956?q=80&w=1950&auto=format&fit=crop"
                />
              </div>
            </div>

            {/* Plus Sign */}
            <div className="relative z-10 hidden md:block">
              <div className="text-4xl lg:text-6xl font-black text-white text-outline drop-shadow-xl rotate-12 hover:rotate-45 transition-transform cursor-default">
                +
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative group w-full md:w-1/2 max-w-sm lg:max-w-md">
              <div className="absolute -top-3 lg:-top-5 -right-3 lg:-right-5 bg-pop-green text-white w-10 h-10 lg:w-14 lg:h-14 flex items-center justify-center rounded-full border-bold shadow-hard z-20 text-xl lg:text-2xl font-black -rotate-12 group-hover:rotate-0 transition-transform">
                2
              </div>
              <div className="card-pop p-3 lg:p-6 bg-white -rotate-1 group-hover:rotate-0 transition-transform">
                <h2 className="text-lg lg:text-2xl font-black mb-2 lg:mb-4 text-center bg-banana text-black inline-block px-2 lg:px-3 py-1 border-bold shadow-hard rotate-2">
                  {t.theGoods}
                </h2>
                <ImageUploader
                  label={t.dropProduct}
                  image={productImage}
                  onImageUpload={handleImageUpload(setProductImage)}
                  exampleImage="https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1999&auto=format&fit=crop"
                />
              </div>
            </div>
          </div>

          {/* Action Area */}
          <div className="text-center pt-2 lg:pt-4">
            {error && (
              <div className="inline-block bg-red-100 border-bold text-red-600 px-4 sm:px-6 py-2 sm:py-3 rounded-lg mb-4 sm:mb-6 font-bold shadow-hard rotate-1 text-sm sm:text-base">
                🚨 {error}
              </div>
            )}

            <button
              onClick={handleGenerateComposition}
              disabled={!avatarImage || !productImage || isGenerating}
              className={`
                btn-pop text-base lg:text-xl px-6 lg:px-10 py-3 lg:py-5 rounded-xl w-full sm:w-auto
                ${(!avatarImage || !productImage) ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:-translate-y-1 active:translate-y-1'}
              `}
            >
              {isGenerating ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="animate-spin text-2xl">🍌</span>
                  {t.peeling}
                </span>
              ) : (
                `✨ ${t.mixItUp} ✨`
              )}
            </button>
          </div>
        </div>
      </main>

      {/* Branding Badge */}
      <div className="absolute bottom-3 lg:bottom-4 right-3 lg:right-4 z-50 flex items-center gap-2 bg-white border-bold px-2 sm:px-3 py-2 rounded-full shadow-hard hover:-translate-y-1 transition-transform cursor-default">
        <span className="hidden sm:block text-[10px] font-black text-black uppercase tracking-wider">{t.handPeeledBy}</span>
        <img
          src="/js5-logo.png"
          alt="JS5 Logo"
          className="h-6 sm:h-8 w-auto object-contain"
        />
      </div>
    </div>
  );
}
