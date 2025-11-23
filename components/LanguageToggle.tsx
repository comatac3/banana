"use client";

import { useLanguage } from "@/contexts/LanguageContext";

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1 bg-white border-2 border-black rounded-full p-1 shadow-hard">
      <button
        onClick={() => setLanguage("en")}
        className={`px-3 py-1 rounded-full font-bold text-sm transition-all ${
          language === "en"
            ? "bg-banana text-black"
            : "text-gray-500 hover:text-black"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage("th")}
        className={`px-3 py-1 rounded-full font-bold text-sm transition-all ${
          language === "th"
            ? "bg-banana text-black"
            : "text-gray-500 hover:text-black"
        }`}
      >
        TH
      </button>
    </div>
  );
}
