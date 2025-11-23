"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import ImageComposer from "@/components/ImageComposer";
import * as storage from "@/utils/storage";

export default function StudioPage() {
    const router = useRouter();
    const supabase = createClient();
    const [user, setUser] = useState<any>(null);
    const [credits, setCredits] = useState<number | null>(null);
    const [composedImage, setComposedImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

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

            // Load composition data from IndexedDB
            const savedData = await storage.getItem<string>("banana_composition_data");
            if (savedData) {
                setComposedImage(savedData);
            } else {
                router.push("/");
            }
            setLoading(false);
        };

        init();
    }, [router, supabase]);

    const handleReset = async () => {
        await storage.removeItem("banana_composition_data");
        router.push("/");
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        await storage.removeItem("banana_composition_data");
        window.location.href = "/";
    };

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-white">
            <div className="text-center">
                <div className="text-6xl animate-bounce mb-4">🍌</div>
                <div className="text-xl font-black">LOADING STUDIO...</div>
            </div>
        </div>
    );

    if (!composedImage || !user) return null;

    return (
        <ImageComposer
            composedImage={composedImage}
            onReset={handleReset}
            user={user}
            credits={credits}
            onSignOut={handleSignOut}
        />
    );
}
