import { useState, useRef } from "react";
import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";

interface ImageUploaderProps {
  label: string;
  image: string | null;
  onImageUpload: (image: string | null) => void;
  exampleImage?: string;
}

export default function ImageUploader({ label, image, onImageUpload, exampleImage }: ImageUploaderProps) {
  const { t } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        onImageUpload(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        onImageUpload(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const [loadingExample, setLoadingExample] = useState(false);

  const handleUseExample = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!exampleImage) return;

    setLoadingExample(true);
    try {
      // Fetch the image and convert to base64
      const response = await fetch(exampleImage);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = () => {
        onImageUpload(reader.result as string);
        setLoadingExample(false);
      };
      reader.onerror = () => {
        console.error("Failed to convert example image");
        setLoadingExample(false);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Failed to load example image:", error);
      setLoadingExample(false);
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        ref={fileInputRef}
      />

      {image ? (
        <div className="relative group">
          <div className="relative aspect-square w-full max-h-[30vh] lg:max-h-[40vh] overflow-hidden border-bold rounded-xl bg-white shadow-hard rotate-1 group-hover:rotate-0 transition-transform">
            <Image
              src={image}
              alt="Uploaded"
              fill
              className="object-cover"
            />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onImageUpload(null);
            }}
            className="absolute -top-3 -right-3 bg-red-500 text-white p-2 rounded-full border-bold shadow-hard hover:scale-110 transition-transform z-10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            aspect-square w-full max-h-[30vh] lg:max-h-[40vh] rounded-xl border-4 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-200 relative group
            ${isDragging
              ? "border-pop-pink bg-pink-50 scale-105 rotate-2"
              : "border-gray-300 hover:border-banana hover:bg-yellow-50 hover:-rotate-1"
            }
          `}
        >
          <div className={`text-5xl lg:text-6xl mb-3 lg:mb-4 transition-transform ${isDragging ? 'scale-125 bounce' : ''}`}>
            {isDragging ? "🤩" : "📸"}
          </div>
          <p className="text-base lg:text-lg font-bold text-gray-400 text-center px-4">
            {label}
          </p>
          <p className="text-sm lg:text-base text-gray-400 mt-2 font-medium">
            {t.clickOrDrag}
          </p>

          {exampleImage && (
            <button
              onClick={handleUseExample}
              disabled={loadingExample}
              className="mt-4 px-4 py-1 bg-gray-100 hover:bg-pop-blue hover:text-white text-gray-500 rounded-full text-sm font-bold border-2 border-gray-200 hover:border-black transition-all z-10 disabled:opacity-50 disabled:cursor-wait"
            >
              {loadingExample ? "Loading..." : "Try Example"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
