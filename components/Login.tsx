"use client";

import { createClient } from "@/utils/supabase/client";
import { useState } from "react";

export default function Login() {
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    const handleLogin = async (provider: "google" | "line") => {
        setLoading(true);
        try {
            const redirectTo = `${window.location.origin}/auth/callback`;
            const { error } = await supabase.auth.signInWithOAuth({
                provider: provider as any,
                options: {
                    redirectTo,
                },
            });
            if (error) throw error;
        } catch (error) {
            console.error("Error logging in:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full border-4 border-black shadow-hard rotate-1">
                <div className="text-center mb-6">
                    <h2 className="text-3xl font-black text-black mb-2">WELCOME! 🍌</h2>
                    <p className="text-gray-600 font-bold">
                        Sign in to get <span className="text-pop-pink text-lg">10 FREE CREDITS</span>
                    </p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => handleLogin("google")}
                        disabled={loading}
                        className="w-full bg-white border-2 border-black p-3 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors font-bold shadow-sm"
                    >
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6" />
                        Continue with Google
                    </button>

                    <button
                        onClick={() => handleLogin("line")}
                        disabled={loading}
                        className="w-full bg-[#00B900] border-2 border-black text-white p-3 rounded-xl flex items-center justify-center gap-3 hover:opacity-90 transition-opacity font-bold shadow-sm"
                    >
                        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                            <path d="M20.3 10.5c0-4.6-4.6-8.4-10.3-8.4S-.3 5.9-.3 10.5c0 4.1 3.6 7.6 8.6 8.3.3.1.8.2.9.6.1.3.1.7 0 1.1-.1.5-.4 1.8-.5 2.2-.1.6-.5 2.2 1.9 1.2 2.4-1 6.5-3.8 8.9-6.5 2.2-2.4 3.3-5.1 3.3-8.1zM10 13.8c0 .2-.2.4-.4.4H5.4c-.2 0-.4-.2-.4-.4v-4.6c0-.2.2-.4.4-.4.2 0 .4.2.4.4v4.2h3.8c.2 0 .4.2.4.4zm3.1 0c0 .2-.2.4-.4.4h-1.4c-.2 0-.4-.2-.4-.4v-4.6c0-.2.2-.4.4-.4h1.4c.2 0 .4.2.4.4v4.6zm3.9 0c0 .2-.2.4-.4.4h-1.4c-.2 0-.4-.2-.4-.4v-4.6c0-.2.2-.4.4-.4h1.4c.2 0 .4.2.4.4v2.8l1.9-2.7c.1-.1.2-.1.3-.1.2 0 .4.2.4.4v4.6c0 .2-.2.4-.4.4-.2 0-.4-.2-.4-.4v-2.9l-2 2.8c0 .1-.1.1-.1.1h-.3z" />
                        </svg>
                        Continue with LINE
                    </button>
                </div>

                <p className="text-center mt-6 text-xs text-gray-500 font-medium">
                    By continuing, you agree to peel bananas responsibly.
                </p>
            </div>
        </div>
    );
}
