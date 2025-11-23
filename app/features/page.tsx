"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import LanguageToggle from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";

const FEATURES = [
  {
    id: 'studio',
    name: 'THE STUDIO',
    nameAlt: 'สตูดิโอสินค้า',
    description: 'Cook up winning ads with our AI product studio. Drop your product, pick a vibe, and watch the magic happen.',
    descriptionAlt: 'สร้างโฆษณาสินค้าสุดปังด้วย AI สตูดิโอ แค่วางสินค้า เลือกสไตล์ แล้วรอชมความมหัศจรรย์',
    icon: '🎨',
    color: 'bg-yellow-400',
    rotate: '-rotate-1',
    href: '/',
    features: [
      'Smart composition',
      'Pro lighting',
      'High-res output',
    ],
    featuresAlt: [
      'จัดองค์ประกอบอัจฉริยะ',
      'จัดแสงระดับโปร',
      'ความละเอียดสูง',
    ],
    cost: '1-2 credits',
    sampleType: 'image',
    sampleUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1999&auto=format&fit=crop',
  },
  {
    id: 'video',
    name: 'VIDEO MAKER',
    nameAlt: 'สร้างวิดีโอ',
    description: 'Turn static pics into viral gold. Use Veo3, Runway, or Kling to add that cinematic motion.',
    descriptionAlt: 'เปลี่ยนภาพนิ่งให้เป็นไวรัล ใช้ Veo3, Runway หรือ Kling เพื่อเพิ่มการเคลื่อนไหวระดับภาพยนตร์',
    icon: '🎬',
    color: 'bg-pink-400',
    rotate: 'rotate-1',
    href: '/video',
    features: [
      'Cinematic moves',
      '10s duration',
      '4K ready',
    ],
    featuresAlt: [
      'มุมกล้องภาพยนตร์',
      'ความยาว 10 วินาที',
      'รองรับ 4K',
    ],
    cost: '6-10 credits',
    sampleType: 'video',
    sampleUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1490750967868-58cb75063ed4?q=80&w=2070&auto=format&fit=crop',
  },
  {
    id: 'model-pose',
    name: 'POSE MASTER',
    nameAlt: 'ท่าโพสโมเดล',
    description: 'Fix that awkward pose instantly. Perfect for fashion shots that need a specific attitude.',
    descriptionAlt: 'แก้ท่าโพสเกร็งๆ ได้ทันที เหมาะสำหรับภาพแฟชั่นที่ต้องการอินเนอร์เป๊ะๆ',
    icon: '🧍',
    color: 'bg-blue-400',
    rotate: '-rotate-1',
    href: '/model-pose',
    features: [
      '28+ Pro poses',
      'Natural vibes',
      'Keep details',
    ],
    featuresAlt: [
      '28+ ท่าโพสระดับโปร',
      'ดูเป็นธรรมชาติ',
      'เก็บรายละเอียดครบ',
    ],
    cost: '2 credits',
    sampleType: 'image',
    sampleUrl: 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?q=80&w=1950&auto=format&fit=crop',
  },
  {
    id: 'assets',
    name: 'THE STASH',
    nameAlt: 'คลังสื่อ',
    description: 'Your creative treasure chest. Keep all your generated gems safe and organized in one place.',
    descriptionAlt: 'หีบสมบัติความคิดสร้างสรรค์ของคุณ เก็บผลงานทั้งหมดไว้อย่างปลอดภัยและเป็นระเบียบ',
    icon: '📁',
    color: 'bg-green-400',
    rotate: 'rotate-1',
    href: '/asset',
    features: [
      'Cloud storage',
      'Bulk download',
      'Secure & safe',
    ],
    featuresAlt: [
      'พื้นที่เก็บข้อมูลบนคลาวด์',
      'ดาวน์โหลดทีละหลายรูป',
      'ปลอดภัยและเป็นส่วนตัว',
    ],
    cost: 'Free access',
    sampleType: 'image',
    sampleUrl: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=2068&auto=format&fit=crop',
  },
];

export default function FeaturesPage() {
  const router = useRouter();
  const supabase = createClient();
  const { language } = useLanguage();
  const isThai = language === 'th';

  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#fffdf5]">
      <div className="flex flex-col items-center gap-4">
        <div className="text-6xl animate-bounce">🍌</div>
        <div className={`font-['Bangers'] text-2xl tracking-wider ${isThai ? 'font-mitr font-medium' : ''}`}>
          {isThai ? 'กำลังโหลด...' : 'LOADING...'}
        </div>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className={`min-h-screen bg-[#fffdf5] text-black selection:bg-yellow-400 selection:text-black relative overflow-hidden font-['Bangers'] ${isThai ? 'font-mitr' : ''}`}>
      {/* Dot Pattern Background */}
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_2px,transparent_2px)] [background-size:24px_24px] pointer-events-none" />

      {/* Header */}
      <div className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-sm border-b-4 border-black transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => router.push("/")}>
            <span className="text-4xl group-hover:rotate-12 transition-transform duration-300">🍌</span>
            <span className="font-['Bangers'] text-3xl tracking-wide pt-1">BANANA STUDIO</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-300 rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all">
              <span className={`font-['Bangers'] text-xl tracking-wide pt-0.5 ${isThai ? 'font-mitr font-medium text-lg pt-0' : ''}`}>
                {credits} {isThai ? 'เครดิต' : 'CREDITS'}
              </span>
            </div>
            <div className="hidden md:block">
              <LanguageToggle />
            </div>
            <button
              onClick={handleSignOut}
              className={`font-['Bangers'] text-xl text-gray-500 hover:text-red-500 transition-colors pt-1 ${isThai ? 'font-mitr font-medium text-lg pt-0' : ''}`}
            >
              {isThai ? 'ออกจากระบบ' : 'SIGN OUT'}
            </button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="pt-40 pb-20 px-6 max-w-7xl mx-auto text-center relative z-10">
        <div className="inline-block px-6 py-2 bg-yellow-400 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] -rotate-2 mb-8 transform hover:rotate-0 transition-transform cursor-default">
          <span className={`font-['Bangers'] text-xl tracking-wide ${isThai ? 'font-mitr font-medium text-lg' : ''}`}>
            {isThai ? 'ขับเคลื่อนโดย GEMINI 2.5 FLASH' : 'POWERED BY GEMINI 2.5 FLASH'}
          </span>
        </div>

        <h1 className={`text-7xl md:text-9xl font-['Bangers'] text-white mb-8 leading-none drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] ${isThai ? 'font-mitr font-semibold text-6xl md:text-8xl leading-tight tracking-normal' : ''}`} style={{ textShadow: '4px 4px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 4px 4px 0 #000' }}>
          {isThai ? 'สร้างสรรค์' : 'COOK UP'}<br />
          <span className="text-yellow-400">{isThai ? 'โฆษณาปังๆ' : 'WINNING ADS'}</span>
        </h1>

        <p className={`text-2xl md:text-3xl font-['Bangers'] text-gray-700 max-w-3xl mx-auto leading-relaxed mb-12 tracking-wide ${isThai ? 'font-mitr font-medium text-xl md:text-2xl leading-loose tracking-normal' : ''}`}>
          {isThai
            ? 'สร้างภาพโฆษณาสินค้าสุดปังด้วย AI ภายในไม่กี่วินาที ไม่มีทักษะออกแบบ? '
            : 'Create viral-worthy product placements with AI avatars in seconds. No design skills? '
          }
          <span className="text-pink-500 underline decoration-wavy decoration-2">
            {isThai ? 'ไม่มีปัญหา!' : 'No problem!'}
          </span>
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <button
            onClick={() => router.push("/")}
            className={`px-12 py-4 bg-white text-black border-4 border-black rounded-2xl font-['Bangers'] text-2xl hover:bg-yellow-300 transition-all hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-none ${isThai ? 'font-mitr font-semibold text-xl pt-3' : ''}`}
          >
            {isThai ? 'เริ่มสร้างเลย!' : 'START COOKING!'}
          </button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-40 space-y-24 relative z-10">
        {FEATURES.map((feature, index) => (
          <div
            key={feature.id}
            onClick={() => router.push(feature.href)}
            className={`
              group relative bg-white border-4 border-black rounded-3xl p-8 md:p-12
              shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all duration-300 cursor-pointer
              ${feature.rotate} hover:rotate-0
            `}
          >
            {/* Step Badge */}
            <div className={`absolute -top-6 -left-6 w-16 h-16 rounded-full border-4 border-black flex items-center justify-center font-['Bangers'] text-3xl text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-20 ${index % 2 === 0 ? 'bg-pink-400' : 'bg-green-400'}`}>
              {index + 1}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Content Side */}
              <div className={`${index % 2 === 1 ? 'lg:order-2' : ''}`}>
                <div className={`inline-block px-4 py-1 bg-black text-white font-['Bangers'] text-xl tracking-wider -rotate-1 mb-6 ${isThai ? 'font-mitr font-medium text-lg pt-2' : ''}`}>
                  {isThai ? feature.nameAlt : feature.name}
                </div>

                <h2 className={`text-4xl md:text-5xl font-['Bangers'] mb-6 leading-tight ${isThai ? 'font-mitr font-semibold text-3xl md:text-4xl leading-snug tracking-normal' : ''}`}>
                  {isThai ? feature.descriptionAlt : feature.description}
                </h2>

                <div className="space-y-4 mb-8">
                  {(isThai ? feature.featuresAlt : feature.features).map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className={`font-['Bangers'] text-xl text-gray-800 tracking-wide ${isThai ? 'font-mitr font-medium text-lg tracking-normal' : ''}`}>{f}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-6 border-t-4 border-black border-dashed">
                  <div className={`font-['Bangers'] text-2xl text-gray-500 ${isThai ? 'font-mitr font-medium text-xl' : ''}`}>
                    {feature.cost}
                  </div>
                  <button className={`px-6 py-2 bg-black text-white font-['Bangers'] text-xl rounded-lg hover:bg-gray-800 transition-colors ${isThai ? 'font-mitr font-semibold text-lg pt-2' : ''}`}>
                    {isThai ? 'ลองเลย →' : 'TRY IT →'}
                  </button>
                </div>
              </div>

              {/* Media Side */}
              <div className={`
                relative aspect-[4/3] rounded-2xl overflow-hidden border-4 border-black bg-gray-100
                ${index % 2 === 1 ? 'lg:order-1' : ''}
              `}>
                {feature.sampleType === 'video' ? (
                  <video
                    src={feature.sampleUrl}
                    poster={(feature as any).posterUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  />
                ) : (
                  <img
                    src={feature.sampleUrl}
                    alt={feature.name}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  />
                )}

                {/* Overlay Text */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20 backdrop-blur-sm">
                  <div className="bg-white border-4 border-black px-6 py-3 transform rotate-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <span className={`font-['Bangers'] text-2xl ${isThai ? 'font-mitr font-semibold text-xl' : ''}`}>
                      {isThai ? 'คลิกเพื่อเปิด!' : 'CLICK TO OPEN!'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats Section */}
      <div className="bg-black text-white py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-16">
            {[
              { label: 'Generation Speed', labelAlt: 'ความเร็วในการสร้าง', value: '< 10s', icon: '⚡' },
              { label: 'Active Users', labelAlt: 'ผู้ใช้งาน', value: '10k+', icon: '👥' },
              { label: 'Assets Created', labelAlt: 'ผลงานที่สร้าง', value: '1M+', icon: '🎨' },
              { label: 'Uptime', labelAlt: 'ความเสถียร', value: '99.9%', icon: '🟢' },
            ].map((stat, i) => (
              <div key={i} className="text-center group">
                <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform duration-300">{stat.icon}</div>
                <div className="text-4xl font-black mb-2">{stat.value}</div>
                <div className={`text-sm font-bold text-gray-500 uppercase tracking-widest ${isThai ? 'font-mitr font-medium text-base' : ''}`}>
                  {isThai ? stat.labelAlt : stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Footer */}
      <div className="py-32 px-6 text-center relative z-10">
        <div className="max-w-4xl mx-auto bg-white border-4 border-black rounded-3xl p-12 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
          <h2 className={`text-6xl font-['Bangers'] mb-8 ${isThai ? 'font-mitr font-semibold text-5xl' : ''}`}>
            {isThai ? 'พร้อมจะลุยหรือยัง?' : 'READY TO MIX IT UP?'}
          </h2>
          <button
            onClick={() => router.push("/")}
            className={`px-16 py-6 bg-yellow-400 text-black border-4 border-black rounded-2xl font-['Bangers'] text-3xl hover:bg-yellow-300 transition-all hover:-translate-y-2 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-none ${isThai ? 'font-mitr font-semibold text-2xl pt-4' : ''}`}
          >
            {isThai ? 'เริ่มใช้งานทันที' : 'GET STARTED NOW'}
          </button>
        </div>
      </div>
    </div>
  );
}
