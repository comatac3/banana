"use client";

import React from "react";
import { useRouter } from "next/navigation";

interface FeatureItem {
    id: string;
    title: string;
    functions: string[];
    capabilities: string[];
    suitableFor?: string[];
    type?: string;
    style?: string;
    color: string;
    exampleImage: string;
}

const IMAGE_FEATURES: FeatureItem[] = [
    {
        id: "img-1",
        title: "1) Image-to-Image Generation",
        functions: ["image.generate + \"image_reference\"", "imageToImage", "i2i"],
        capabilities: [
            "เปลี่ยนฉากหลังสินค้า",
            "เปลี่ยนโทนไฟ",
            "ทำเวอร์ชัน lifestyle",
            "ทำเวอร์ชัน UGC",
            "ทำเวอร์ชัน studio shot",
            "เพิ่ม/ลดเงา",
            "เปลี่ยนวัสดุโต๊ะ/ฉากหลัง",
            "เปลี่ยน perspective / มุมกล้อง",
            "ทำเหมือน “ถ่ายใหม่”"
        ],
        suitableFor: ["ร้านค้าออนไลน์", "เสื้อผ้า", "เครื่องสำอาง", "อาหาร"],
        color: "bg-pop-blue",
        exampleImage: "/images/features/img-1.png"
    },
    {
        id: "img-2",
        title: "2) Background Removal / Replacement",
        functions: ["image.removeBackground", "image.replaceBackground", "backgroundReplace"],
        capabilities: [
            "ลบพื้นหลังสินค้าให้เป็นโปร่งใส",
            "ใส่สีพื้นหลัง (ขาว, ครีม, พาสเทล)",
            "วางสินค้าในฉากใหม่ เช่น ห้องครัว/โต๊ะไม้/สตูดิโอ"
        ],
        color: "bg-pop-green",
        exampleImage: "/images/features/img-2.png"
    },
    {
        id: "img-3",
        title: "3) Image Variation",
        functions: ["image.variations", "generateVariations"],
        capabilities: [
            "สร้าง 10 ภาพจากภาพต้นฉบับ",
            "เปลี่ยนมุมสินค้า",
            "เปลี่ยนสไตล์โทน",
            "เปลี่ยนสภาพแสง"
        ],
        color: "bg-banana",
        exampleImage: "/images/features/img-3.png"
    },
    {
        id: "img-4",
        title: "4) Image Inpainting",
        functions: ["image.edit", "image.inpaint"],
        capabilities: [
            "เพิ่มโลโก้บนสินค้า",
            "ลบคราบ/รอย/ตำหนิ",
            "แก้ตำแหน่งสินค้า",
            "เปลี่ยนสีสินค้า (เช่น เสื้อสีแดง → สีดำ)",
            "เติมบางส่วนที่หายไป"
        ],
        color: "bg-pop-pink",
        exampleImage: "/images/features/img-4.png"
    },
    {
        id: "img-5",
        title: "5) Product Mockup Generation",
        functions: ["product.mockup.render", "mockup.generate"],
        capabilities: [
            "เอาภาพสินค้าไปแปะบน mockup จริง",
            "ขวด, ถุง, กล่อง, เสื้อ, แก้ว, ชุดบิวตี้",
            "เปลี่ยนขนาด/มุมของลาย"
        ],
        color: "bg-pop-purple",
        exampleImage: "/images/features/img-5.png"
    },
    {
        id: "img-6",
        title: "6) Product Placement",
        functions: ["image.productPlacement", "scene.generate"],
        capabilities: [
            "วางสินค้าในฉากร้านอาหาร",
            "ใส่สินค้าในโต๊ะทำงาน",
            "วางสินค้าบนโต๊ะคาเฟ่",
            "Lifestyle product photo"
        ],
        color: "bg-pop-blue",
        exampleImage: "/images/features/img-6.png"
    },
    {
        id: "img-7",
        title: "7) Refine / Enhance / Clean Up",
        functions: ["image.upscale", "image.enhance", "image.clean"],
        capabilities: [
            "เพิ่มความละเอียด",
            "ลบ noise",
            "ทำให้ภาพคมขึ้น",
            "ทำให้สีดูเป็นมืออาชีพ"
        ],
        color: "bg-pop-green",
        exampleImage: "/images/features/img-7.png"
    },
    {
        id: "img-8",
        title: "8) Text-to-Image for Product",
        functions: ["images.generate", "textToImage"],
        capabilities: [
            "สร้างภาพสินค้าใหม่จาก prompt",
            "ใส่สไตล์ studio shot",
            "ทำโฆษณาสินค้าแฟนตาซี",
            "สร้างสินค้าที่ยังไม่มีรูปจริง"
        ],
        color: "bg-banana",
        exampleImage: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: "img-9",
        title: "9) Face Swap / Model Replace",
        functions: ["reactor.swapFace", "model.swap"],
        capabilities: [
            "เอาหน้าโมเดลตัวเองไปใส่ภาพเสื้อผ้า",
            "เปลี่ยนคนในภาพเป็นนางแบบของร้าน",
            "ทำ try-on effect"
        ],
        color: "bg-pop-pink",
        exampleImage: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: "img-10",
        title: "10) Cloth Transfer / Try-On",
        functions: ["virtualTryOn", "vton.generate"],
        capabilities: [
            "ลูกค้าอัปโหลดรูปตัวเอง → ลองใส่เสื้อ",
            "เจ้าของร้านเอานางแบบ → ลองใส่สินค้าหลายชุด",
            "ทำ catalog เสื้อนับร้อยภาพอัตโนมัติ"
        ],
        color: "bg-pop-purple",
        exampleImage: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80"
    }
];

const VIDEO_FEATURES: FeatureItem[] = [
    {
        id: "vid-1",
        title: "1) UGC (User-Generated Content Style)",
        functions: [],
        capabilities: [
            "ถ่ายเหมือนคนจริงหยิบมือถือขึ้นมาถ่ายเอง",
            "พูดคุยแบบเป็นกันเอง",
            "เน้นความจริงใจ",
            "ยอดนิยมมากใน TikTok / Reels / Lemon8"
        ],
        suitableFor: ["เสริมความน่าเชื่อถือ", "ปิดการขายเร็ว", "รีวิวสกินแคร์/เสื้อผ้า/อาหาร/ของใช้"],
        type: "UGC",
        style: "Selfie, influencer-style",
        color: "bg-pop-pink",
        exampleImage: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: "vid-2",
        title: "2) B-Roll Product Cinematic",
        functions: [],
        capabilities: [
            "ไม่มีคนพูด (หรือมี Voiceover)",
            "เน้นภาพสินค้า ใกล้ๆ สโลว์โมชั่น",
            "ดูสวย หรู พรีเมียม",
            "ใส่มุมกล้อง cinematic, macro, sweeping shots"
        ],
        suitableFor: ["สินค้าแพง", "แบรนด์ที่ต้องการ mood & tone สูง", "โฆษณาตัดต่อกับสินค้าจริง"],
        type: "B-roll",
        style: "Cinematic, product close-up, slow motion",
        color: "bg-pop-purple",
        exampleImage: "https://images.unsplash.com/photo-1492633423870-43d1cd2775eb?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: "vid-3",
        title: "3) Model Walk / Fashion Lookbook",
        functions: [],
        capabilities: [
            "นางแบบเดินโชว์สินค้า",
            "กล้องฟูลบอดี้",
            "สไตล์สตูดิโอแฟชั่น",
            "โทนดูแพง"
        ],
        suitableFor: ["เสื้อผ้า", "กระเป๋า", "รองเท้า"],
        type: "Lookbook",
        style: "Model walking, studio fashion",
        color: "bg-banana",
        exampleImage: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: "vid-4",
        title: "4) Commercial / Ad Style",
        functions: [],
        capabilities: [
            "มุมกล้องหลากหลาย",
            "แสงสตูดิโอ",
            "ใส่ motion shot",
            "mood เข้มข้นแบบโฆษณาทีวี"
        ],
        suitableFor: ["วิดีโอเปิดตัวสินค้า", "โฆษณาแบบมืออาชีพ"],
        type: "Commercial",
        style: "High-end advertising",
        color: "bg-pop-blue",
        exampleImage: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: "vid-5",
        title: "5) Social Media Short Ad",
        functions: [],
        capabilities: [
            "เร็ว 3–5 วินาที",
            "ตรงประเด็น",
            "เอฟเฟกต์นิดๆ",
            "สำหรับ TikTok/IG Ad ซื้อ Ads โดยตรง"
        ],
        type: "Short-form ad",
        style: "Fast-paced, social media",
        color: "bg-pop-green",
        exampleImage: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: "vid-6",
        title: "6) Product Unboxing",
        functions: [],
        capabilities: [
            "มือแกะสินค้า",
            "close-up",
            "เน้นความคุ้มค่าและของจริง"
        ],
        type: "Unboxing",
        color: "bg-pop-pink",
        exampleImage: "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: "vid-7",
        title: "7) Voiceover + Product Clips",
        functions: [],
        capabilities: [
            "ไม่มีคนพูดหน้ากล้อง",
            "มีคลิปสินค้า + voiceover"
        ],
        type: "Voiceover product promo",
        color: "bg-pop-purple",
        exampleImage: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: "vid-8",
        title: "8) Aesthetic Mood Video",
        functions: [],
        capabilities: [
            "ธรรมชาติ",
            "โทนนุ่มละมุน",
            "สินค้าดู lifestyle"
        ],
        type: "Aesthetic lifestyle",
        color: "bg-banana",
        exampleImage: "https://images.unsplash.com/photo-1516961642265-531546e84af2?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: "vid-9",
        title: "9) Stop-Motion Product",
        functions: [],
        capabilities: [
            "ของขยับสั้นๆ",
            "เล่นกับฉากพื้นหลัง",
            "น่ารัก เป็นกันเอง"
        ],
        type: "Stop-motion",
        color: "bg-pop-blue",
        exampleImage: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=80"
    }
];

export default function NewFeaturesPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen p-4 lg:p-8 bg-background font-['Bangers']">
            {/* Header */}
            <header className="max-w-6xl mx-auto mb-12 text-center">
                <button
                    onClick={() => router.push('/')}
                    className="mb-8 inline-block px-4 py-2 bg-white border-bold shadow-hard rounded-lg hover:-translate-y-1 transition-transform font-bold text-sm"
                >
                    ← BACK TO HOME
                </button>

                <h1 className="text-4xl lg:text-7xl font-black mb-4 text-outline text-white drop-shadow-xl">
                    NEW <span className="text-banana text-outline">FEATURES</span>
                </h1>
                <p className="text-xl lg:text-2xl font-bold text-gray-800 max-w-3xl mx-auto bg-white/80 backdrop-blur-sm p-4 rounded-xl border-bold shadow-hard font-mitr">
                    รวมฟีเจอร์ใหม่สำหรับสร้างสรรค์ภาพและวิดีโอสินค้า
                </p>
            </header>

            <main className="max-w-7xl mx-auto space-y-16 pb-20">

                {/* Image Functions Section */}
                <section>
                    <div className="flex items-center gap-4 mb-8">
                        <div className="bg-pop-blue text-white w-12 h-12 lg:w-16 lg:h-16 flex items-center justify-center rounded-full border-bold shadow-hard text-2xl lg:text-3xl font-black rotate-3">
                            🖼️
                        </div>
                        <h2 className="text-3xl lg:text-5xl font-black text-outline text-white drop-shadow-lg">
                            IMAGE FUNCTIONS
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                        {IMAGE_FEATURES.map((feature) => (
                            <div key={feature.id} className="card-pop p-6 bg-white hover:rotate-1 transition-transform h-full flex flex-col font-mitr">
                                <div className={`inline-block px-3 py-1 mb-4 border-2 border-black shadow-[2px_2px_0px_0px_#000] rounded-md font-bold text-sm ${feature.color} text-black`}>
                                    {feature.functions[0] || "Function"}
                                </div>

                                {/* Example Image */}
                                <div className="mb-4 rounded-lg border-2 border-black overflow-hidden aspect-video relative group">
                                    <img
                                        src={feature.exampleImage}
                                        alt={feature.title}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                                </div>

                                <h3 className="text-xl lg:text-2xl font-black mb-4 leading-tight border-b-2 border-black pb-2">
                                    {feature.title}
                                </h3>

                                <div className="space-y-4 flex-grow">
                                    <div>
                                        <h4 className="font-bold text-gray-500 text-sm mb-1 uppercase">Capabilities:</h4>
                                        <ul className="list-disc list-inside space-y-1 text-sm lg:text-base">
                                            {feature.capabilities.map((cap, idx) => (
                                                <li key={idx} className="text-gray-800">{cap}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    {feature.suitableFor && (
                                        <div>
                                            <h4 className="font-bold text-gray-500 text-sm mb-1 uppercase">Suitable For:</h4>
                                            <p className="text-sm text-gray-600">{feature.suitableFor.join(", ")}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Video Functions Section */}
                <section>
                    <div className="flex items-center gap-4 mb-8">
                        <div className="bg-pop-pink text-white w-12 h-12 lg:w-16 lg:h-16 flex items-center justify-center rounded-full border-bold shadow-hard text-2xl lg:text-3xl font-black -rotate-3">
                            🎥
                        </div>
                        <h2 className="text-3xl lg:text-5xl font-black text-outline text-white drop-shadow-lg">
                            VIDEO FUNCTIONS
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                        {VIDEO_FEATURES.map((feature) => (
                            <div key={feature.id} className="card-pop p-6 bg-white hover:-rotate-1 transition-transform h-full flex flex-col font-mitr">
                                <div className={`inline-block px-3 py-1 mb-4 border-2 border-black shadow-[2px_2px_0px_0px_#000] rounded-md font-bold text-sm ${feature.color} text-black`}>
                                    {feature.type || "Video Type"}
                                </div>

                                {/* Example Video Thumbnail */}
                                <div className="mb-4 rounded-lg border-2 border-black overflow-hidden aspect-video relative group cursor-pointer">
                                    <img
                                        src={feature.exampleImage}
                                        alt={feature.title}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                        <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-hard border-2 border-black group-hover:scale-110 transition-transform">
                                            <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-black border-b-[8px] border-b-transparent ml-1"></div>
                                        </div>
                                    </div>
                                </div>

                                <h3 className="text-xl lg:text-2xl font-black mb-4 leading-tight border-b-2 border-black pb-2">
                                    {feature.title}
                                </h3>

                                <div className="space-y-4 flex-grow">
                                    <div>
                                        <h4 className="font-bold text-gray-500 text-sm mb-1 uppercase">Capabilities:</h4>
                                        <ul className="list-disc list-inside space-y-1 text-sm lg:text-base">
                                            {feature.capabilities.map((cap, idx) => (
                                                <li key={idx} className="text-gray-800">{cap}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    {feature.suitableFor && (
                                        <div>
                                            <h4 className="font-bold text-gray-500 text-sm mb-1 uppercase">Suitable For:</h4>
                                            <p className="text-sm text-gray-600">{feature.suitableFor.join(", ")}</p>
                                        </div>
                                    )}

                                    {(feature.type || feature.style) && (
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                            {feature.type && (
                                                <div className="mb-1">
                                                    <span className="font-bold text-xs uppercase text-gray-500">Type: </span>
                                                    <span className="font-mono text-sm text-pop-blue">"{feature.type}"</span>
                                                </div>
                                            )}
                                            {feature.style && (
                                                <div>
                                                    <span className="font-bold text-xs uppercase text-gray-500">Style: </span>
                                                    <span className="font-mono text-sm text-pop-pink">"{feature.style}"</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

            </main>
        </div>
    );
}
