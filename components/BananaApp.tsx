"use client";

import { useState, useEffect } from "react";
import ImageUploader from "@/components/ImageUploader";
import ImageComposer from "@/components/ImageComposer";
import { createClient } from "@/utils/supabase/client";

export default function BananaApp({ user }: { user: any }) {
    const [composedImage, setComposedImage] = useState<string | null>(null);
    const [avatarImage, setAvatarImage] = useState<string | null>(null);
    const [productImage, setProductImage] = useState<string | null>(null);
    const [credits, setCredits] = useState<number | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        const fetchCredits = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('credits')
                .eq('id', user.id)
                .single();

            if (data) {
                setCredits(data.credits);
            }
        };
        fetchCredits();
    }, [user, supabase]);

    const handleReset = () => {
        setComposedImage(null);
        // Refresh credits on reset
        const fetchCredits = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('credits')
                .eq('id', user.id)
                .single();
            if (data) setCredits(data.credits);
        };
        fetchCredits();
    };

    const handleGenerateComposition = async () => {
        if (!avatarImage || !productImage) return;

        setIsGenerating(true);
        setError(null);

        try {
            const response = await fetch("/api/compose", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ avatarImage, productImage }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to compose images");
            }

            setComposedImage(data.composedImage);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setIsGenerating(false);
        }
    };

    if (composedImage) {
        return (
            <ImageComposer
                composedImage={composedImage}
                onReset={handleReset}
            />
        );
    }

    return (
        <main className="h-screen p-4 sm:p-6 lg:p-8 relative overflow-hidden flex flex-col">
            <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col justify-center">
                <div className="grid md:grid-cols-2 gap-6 lg:gap-8 mb-6 lg:mb-8">
                    <div className="relative group">
                        <div className="absolute -top-3 lg:-top-5 -left-3 lg:-left-5 bg-pop-pink text-white w-10 h-10 lg:w-14 lg:h-14 flex items-center justify-center rounded-full border-bold shadow-hard z-20 text-xl lg:text-2xl font-black rotate-12 group-hover:rotate-0 transition-transform">
                            1
                        </div>
                        <div className="card-pop p-4 lg:p-6 bg-white rotate-1 group-hover:rotate-0 transition-transform">
                            <h2 className="text-lg lg:text-2xl font-black mb-3 lg:mb-4 text-center bg-pop-blue text-white inline-block px-3 py-1 border-bold shadow-hard -rotate-2">
                                THE TALENT
                            </h2>
                            <ImageUploader
                                label="Drop your avatar image here"
                                image={avatarImage}
                                onImageUpload={setAvatarImage}
                            />
                        </div>
                    </div>

                    <div className="relative group">
                        <div className="absolute -top-3 lg:-top-5 -right-3 lg:-right-5 bg-pop-green text-white w-10 h-10 lg:w-14 lg:h-14 flex items-center justify-center rounded-full border-bold shadow-hard z-20 text-xl lg:text-2xl font-black -rotate-12 group-hover:rotate-0 transition-transform">
                            2
                        </div>
                        <div className="card-pop p-4 lg:p-6 bg-white -rotate-1 group-hover:rotate-0 transition-transform">
                            <h2 className="text-lg lg:text-2xl font-black mb-3 lg:mb-4 text-center bg-banana text-black inline-block px-3 py-1 border-bold shadow-hard rotate-2">
                                THE GOODS
                            </h2>
                            <ImageUploader
                                label="Drop your product image here"
                                image={productImage}
                                onImageUpload={setProductImage}
                            />
                        </div>
                    </div>
                </div>

                <div className="text-center">
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
                                PEELING...
                            </span>
                        ) : (
                            `✨ MIX IT UP! ✨`
                        )}
                    </button>
                </div>
            </div>
        </main>
    );
}
