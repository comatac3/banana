"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type Language = "en" | "th";

interface Translations {
  // Header
  poweredBy: string;
  cookUp: string;
  winningAds: string;
  tagline: string;
  noDesignSkills: string;
  noProblem: string;

  // Upload Section
  theTalent: string;
  theGoods: string;
  dropAvatar: string;
  dropProduct: string;
  clickOrDrag: string;

  // Button
  mixItUp: string;
  peeling: string;

  // Composer
  studio: string;
  step2: string;
  tipDrag: string;
  scale: string;
  rotation: string;
  quickStyles: string;
  aiPrompt: string;
  promptPlaceholder: string;
  enhanceWithAI: string;
  enhancing: string;
  startOver: string;
  masterpiece: string;
  adReady: string;
  tryDifferentStyle: string;
  customPrompt: string;
  regenerate: string;
  regenerating: string;
  download: string;
  createNew: string;

  // Styles
  professional: string;
  lifestyle: string;
  vibrant: string;
  minimal: string;
  outdoor: string;
  studioStyle: string;
  luxury: string;
  neonCity: string;
  retro: string;
  anime: string;
  fashion: string;
  cozy: string;
  dynamic: string;
  dreamy: string;
  bold: string;
  natural: string;

  // Footer
  handPeeledBy: string;
}

const translations: Record<Language, Translations> = {
  en: {
    // Header
    poweredBy: "POWERED BY GEMINI 2.5 FLASH",
    cookUp: "COOK UP",
    winningAds: "WINNING ADS",
    tagline: "Create viral-worthy product placements with AI avatars in seconds.",
    noDesignSkills: "No design skills?",
    noProblem: "No problem!",

    // Upload Section
    theTalent: "THE TALENT",
    theGoods: "THE GOODS",
    dropAvatar: "Drop your Avatar here!",
    dropProduct: "Drop your Product here!",
    clickOrDrag: "(Click or Drag & Drop)",

    // Button
    mixItUp: "MIX IT UP!",
    peeling: "PEELING...",

    // Composer
    studio: "STUDIO",
    step2: "Step 2: Adjust & Enhance",
    tipDrag: "Tip: Drag the product to move it, or scroll to resize!",
    scale: "SCALE",
    rotation: "ROTATION",
    quickStyles: "QUICK STYLES",
    aiPrompt: "AI PROMPT (OPTIONAL)",
    promptPlaceholder: "e.g., Make it cinematic, add a beach background...",
    enhanceWithAI: "ENHANCE WITH AI",
    enhancing: "ENHANCING...",
    startOver: "Start Over",
    masterpiece: "IT'S A MASTERPIECE!",
    adReady: "Your ad is ready to go viral. Download it or try a different style below.",
    tryDifferentStyle: "TRY DIFFERENT STYLE",
    customPrompt: "CUSTOM PROMPT",
    regenerate: "REGENERATE",
    regenerating: "REGENERATING...",
    download: "DOWNLOAD",
    createNew: "Create New",

    // Styles
    professional: "Professional",
    lifestyle: "Lifestyle",
    vibrant: "Vibrant",
    minimal: "Minimal",
    outdoor: "Outdoor",
    studioStyle: "Studio",
    luxury: "Luxury",
    neonCity: "Neon City",
    retro: "Retro",
    anime: "Anime",
    fashion: "Fashion",
    cozy: "Cozy",
    dynamic: "Dynamic",
    dreamy: "Dreamy",
    bold: "Bold",
    natural: "Natural",

    // Footer
    handPeeledBy: "Hand-peeled by",
  },
  th: {
    // Header
    poweredBy: "ขับเคลื่อนโดย GEMINI 2.5 FLASH",
    cookUp: "สร้างสรรค์",
    winningAds: "โฆษณาปัง",
    tagline: "สร้างภาพโฆษณาสินค้าสุดปังด้วย AI ภายในไม่กี่วินาที",
    noDesignSkills: "ไม่มีทักษะออกแบบ?",
    noProblem: "ไม่มีปัญหา!",

    // Upload Section
    theTalent: "นายแบบ/นางแบบ",
    theGoods: "สินค้า",
    dropAvatar: "วางรูปอวาตาร์ที่นี่!",
    dropProduct: "วางรูปสินค้าที่นี่!",
    clickOrDrag: "(คลิกหรือลากวาง)",

    // Button
    mixItUp: "สร้างเลย!",
    peeling: "กำลังสร้าง...",

    // Composer
    studio: "สตูดิโอ",
    step2: "ขั้นตอน 2: ปรับแต่ง",
    tipDrag: "เคล็ดลับ: ลากสินค้าเพื่อย้ายตำแหน่ง หรือเลื่อนเพื่อปรับขนาด!",
    scale: "ขนาด",
    rotation: "การหมุน",
    quickStyles: "สไตล์ด่วน",
    aiPrompt: "คำสั่ง AI (ไม่บังคับ)",
    promptPlaceholder: "เช่น ทำให้ดูเหมือนหนัง, เพิ่มพื้นหลังชายหาด...",
    enhanceWithAI: "ปรับปรุงด้วย AI",
    enhancing: "กำลังปรับปรุง...",
    startOver: "เริ่มใหม่",
    masterpiece: "สุดยอดมาก!",
    adReady: "โฆษณาของคุณพร้อมแล้ว ดาวน์โหลดหรือลองสไตล์อื่น",
    tryDifferentStyle: "ลองสไตล์อื่น",
    customPrompt: "คำสั่งเอง",
    regenerate: "สร้างใหม่",
    regenerating: "กำลังสร้างใหม่...",
    download: "ดาวน์โหลด",
    createNew: "สร้างใหม่",

    // Styles
    professional: "มืออาชีพ",
    lifestyle: "ไลฟ์สไตล์",
    vibrant: "สดใส",
    minimal: "มินิมอล",
    outdoor: "กลางแจ้ง",
    studioStyle: "สตูดิโอ",
    luxury: "หรูหรา",
    neonCity: "นีออนซิตี้",
    retro: "เรโทร",
    anime: "อนิเมะ",
    fashion: "แฟชั่น",
    cozy: "อบอุ่น",
    dynamic: "ไดนามิก",
    dreamy: "ดรีมมี่",
    bold: "โดดเด่น",
    natural: "ธรรมชาติ",

    // Footer
    handPeeledBy: "พัฒนาโดย",
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: translations[language],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
