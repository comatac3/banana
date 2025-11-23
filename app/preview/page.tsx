"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import * as storage from "@/utils/storage";

interface Analysis {
  avatar: {
    description: string;
    gender: string;
    age: string;
    pose: string;
    clothing: string;
    expression?: string;
  };
  product: {
    name: string;
    type: string;
    brand: string;
    color: string;
    size: string;
    description: string;
    features?: string[];
  };
  suggestion: {
    placement: string;
    interaction: string;
    style: string;
    background?: string;
  };
}

export default function PreviewPage() {
  const router = useRouter();
  const supabase = createClient();
  const { language } = useLanguage();
  const isThai = language === 'th';

  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Editable fields
  const [productName, setProductName] = useState("");
  const [productType, setProductType] = useState("");
  const [productBrand, setProductBrand] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [placement, setPlacement] = useState("");
  const [interaction, setInteraction] = useState("");
  const [style, setStyle] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");

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

      // Load images from storage
      const avatar = await storage.getItem<string>("banana_preview_avatar");
      const product = await storage.getItem<string>("banana_preview_product");

      if (!avatar || !product) {
        router.push("/");
        return;
      }

      setAvatarImage(avatar);
      setProductImage(product);
      setLoading(false);

      // Auto-analyze
      analyzeImages(avatar, product);
    };

    init();
  }, [router, supabase]);

  const analyzeImages = async (avatar: string, product: string) => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarImage: avatar, productImage: product }),
      });

      const data = await response.json();

      if (response.ok) {
        setAnalysis(data);
        // Set editable fields
        setProductName(data.product?.name || "");
        setProductType(data.product?.type || "");
        setProductBrand(data.product?.brand || "");
        setProductDescription(data.product?.description || "");
        setPlacement(data.suggestion?.placement || "");
        setInteraction(data.suggestion?.interaction || "");
        setStyle(data.suggestion?.style || "");
      } else if (data.error === "content_refused") {
        setAnalysisError(data.message || "The AI could not analyze these images. Please try different images.");
      } else {
        setAnalysisError(data.error || "Failed to analyze images");
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      setAnalysisError("Failed to connect to analysis service");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleProceed = async () => {
    // Save analysis data for studio
    const compositionData = JSON.stringify({
      avatar: avatarImage,
      product: productImage,
      analysis: {
        ...analysis,
        product: {
          ...analysis?.product,
          name: productName,
          type: productType,
          brand: productBrand,
          description: productDescription,
        },
        suggestion: {
          ...analysis?.suggestion,
          placement,
          interaction,
          style,
        },
      },
      customPrompt: customPrompt.trim() || null,
      composition: {
        productScale: 0.3,
        productX: 400,
        productY: 500,
        productRotation: 0,
      },
    });

    await storage.setItem("banana_composition_data", compositionData);
    localStorage.removeItem("banana_has_auto_generated");
    await storage.removeItem("banana_generated_images");
    await storage.removeItem("banana_original_canvas_data");

    router.push("/studio");
  };

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

  return (
    <div className={`min-h-screen bg-[#fffdf5] font-['Bangers'] ${isThai ? 'font-mitr' : ''}`}>
      {/* Header */}
      <div className="bg-white border-b-4 border-black p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="font-black hover:underline flex items-center gap-2"
            >
              ← {isThai ? 'กลับ' : 'Back'}
            </button>
            <h1 className={`text-2xl font-black hidden sm:block ${isThai ? 'font-mitr' : ''}`}>
              {isThai ? 'ตรวจสอบก่อนสร้าง' : 'PREVIEW & EDIT'} 🔍
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-full border-2 border-black font-bold">
              <span>🍌 {credits}</span>
            </div>
            <LanguageToggle />
            <button
              onClick={handleSignOut}
              className="bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 px-3 py-1 rounded-md text-xs font-black"
            >
              {isThai ? 'ออก' : 'Out'}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Analysis Error Alert */}
        {analysisError && (
          <div className="mb-6 p-4 bg-red-50 border-4 border-red-400 rounded-xl shadow-[4px_4px_0px_0px_rgba(239,68,68,1)]">
            <div className="flex items-start gap-3">
              <span className="text-3xl">⚠️</span>
              <div className="flex-1">
                <h3 className={`font-black text-red-700 text-lg mb-1 ${isThai ? 'font-mitr' : ''}`}>
                  {isThai ? 'ไม่สามารถวิเคราะห์รูปภาพได้' : 'Image Analysis Failed'}
                </h3>
                <p className={`text-red-600 font-medium ${isThai ? 'font-mitr' : ''}`}>
                  {analysisError}
                </p>
                <button
                  onClick={() => router.push("/")}
                  className={`mt-3 px-4 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors ${isThai ? 'font-mitr' : ''}`}
                >
                  {isThai ? '← เปลี่ยนรูปภาพ' : '← Change Images'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Images Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Avatar */}
          <div className="bg-white p-4 rounded-xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className={`text-xl font-black mb-4 ${isThai ? 'font-mitr' : ''}`}>
              {isThai ? '👤 อวาตาร์' : '👤 AVATAR'}
            </h2>
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-300">
              {avatarImage && (
                <img src={avatarImage} alt="Avatar" className="w-full h-full object-contain" />
              )}
            </div>
            {analysis?.avatar && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                <p className={`text-sm ${isThai ? 'font-mitr' : ''}`}>
                  <strong>{isThai ? 'AI วิเคราะห์:' : 'AI Analysis:'}</strong> {analysis.avatar.description}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="px-2 py-1 bg-blue-100 rounded text-xs">{analysis.avatar.gender}</span>
                  <span className="px-2 py-1 bg-blue-100 rounded text-xs">{analysis.avatar.pose}</span>
                  <span className="px-2 py-1 bg-blue-100 rounded text-xs">{analysis.avatar.clothing}</span>
                </div>
              </div>
            )}
          </div>

          {/* Product */}
          <div className="bg-white p-4 rounded-xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className={`text-xl font-black mb-4 ${isThai ? 'font-mitr' : ''}`}>
              {isThai ? '📦 สินค้า' : '📦 PRODUCT'}
            </h2>
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-300">
              {productImage && (
                <img src={productImage} alt="Product" className="w-full h-full object-contain" />
              )}
            </div>
            {analyzing ? (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg border-2 border-yellow-200 text-center">
                <span className="animate-spin inline-block mr-2">🔍</span>
                <span className={isThai ? 'font-mitr' : ''}>{isThai ? 'กำลังวิเคราะห์...' : 'Analyzing...'}</span>
              </div>
            ) : analysis?.product && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg border-2 border-green-200">
                <p className={`text-lg font-bold ${isThai ? 'font-mitr' : ''}`}>
                  {analysis.product.name}
                  {analysis.product.brand && ` (${analysis.product.brand})`}
                </p>
                <p className={`text-sm text-gray-600 ${isThai ? 'font-mitr' : ''}`}>
                  {analysis.product.description}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="px-2 py-1 bg-green-100 rounded text-xs">{analysis.product.type}</span>
                  <span className="px-2 py-1 bg-green-100 rounded text-xs">{analysis.product.color}</span>
                  <span className="px-2 py-1 bg-green-100 rounded text-xs">{analysis.product.size}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Editable Analysis */}
        {analysis && (
          <div className="bg-white p-6 rounded-xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-2xl font-black ${isThai ? 'font-mitr' : ''}`}>
                {isThai ? '✏️ แก้ไขข้อมูล' : '✏️ EDIT DETAILS'}
              </h2>
              <button
                onClick={() => setEditMode(!editMode)}
                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                  editMode
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                } ${isThai ? 'font-mitr' : ''}`}
              >
                {editMode ? (isThai ? '✓ เสร็จสิ้น' : '✓ Done') : (isThai ? 'แก้ไข' : 'Edit')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Info */}
              <div className="space-y-4">
                <h3 className={`font-bold text-lg border-b-2 border-black pb-2 ${isThai ? 'font-mitr' : ''}`}>
                  {isThai ? 'ข้อมูลสินค้า' : 'Product Info'}
                </h3>

                <div>
                  <label className={`block text-sm font-bold mb-1 ${isThai ? 'font-mitr' : ''}`}>
                    {isThai ? 'ชื่อสินค้า' : 'Product Name'}
                  </label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    disabled={!editMode}
                    className={`w-full p-3 border-2 rounded-lg font-medium ${
                      editMode ? 'border-black bg-white' : 'border-gray-200 bg-gray-50'
                    } ${isThai ? 'font-mitr' : ''}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-bold mb-1 ${isThai ? 'font-mitr' : ''}`}>
                    {isThai ? 'ประเภท' : 'Type'}
                  </label>
                  <input
                    type="text"
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    disabled={!editMode}
                    className={`w-full p-3 border-2 rounded-lg font-medium ${
                      editMode ? 'border-black bg-white' : 'border-gray-200 bg-gray-50'
                    } ${isThai ? 'font-mitr' : ''}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-bold mb-1 ${isThai ? 'font-mitr' : ''}`}>
                    {isThai ? 'แบรนด์' : 'Brand'}
                  </label>
                  <input
                    type="text"
                    value={productBrand}
                    onChange={(e) => setProductBrand(e.target.value)}
                    disabled={!editMode}
                    placeholder={isThai ? 'ถ้ามี' : 'If any'}
                    className={`w-full p-3 border-2 rounded-lg font-medium ${
                      editMode ? 'border-black bg-white' : 'border-gray-200 bg-gray-50'
                    } ${isThai ? 'font-mitr' : ''}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-bold mb-1 ${isThai ? 'font-mitr' : ''}`}>
                    {isThai ? 'รายละเอียด' : 'Description'}
                  </label>
                  <textarea
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    disabled={!editMode}
                    rows={3}
                    className={`w-full p-3 border-2 rounded-lg font-medium resize-none ${
                      editMode ? 'border-black bg-white' : 'border-gray-200 bg-gray-50'
                    } ${isThai ? 'font-mitr' : ''}`}
                  />
                </div>
              </div>

              {/* Suggestion */}
              <div className="space-y-4">
                <h3 className={`font-bold text-lg border-b-2 border-black pb-2 ${isThai ? 'font-mitr' : ''}`}>
                  {isThai ? 'คำแนะนำการสร้าง' : 'Generation Suggestion'}
                </h3>

                <div>
                  <label className={`block text-sm font-bold mb-1 ${isThai ? 'font-mitr' : ''}`}>
                    {isThai ? 'ตำแหน่งวาง' : 'Placement'}
                  </label>
                  <select
                    value={placement}
                    onChange={(e) => setPlacement(e.target.value)}
                    disabled={!editMode}
                    className={`w-full p-3 border-2 rounded-lg font-medium ${
                      editMode ? 'border-black bg-white' : 'border-gray-200 bg-gray-50'
                    } ${isThai ? 'font-mitr' : ''}`}
                  >
                    <option value="hand">{isThai ? 'ถือในมือ' : 'In hand'}</option>
                    <option value="near face">{isThai ? 'ใกล้ใบหน้า' : 'Near face'}</option>
                    <option value="on table">{isThai ? 'วางบนโต๊ะ' : 'On table'}</option>
                    <option value="worn">{isThai ? 'สวมใส่' : 'Worn'}</option>
                    <option value="beside">{isThai ? 'วางข้างๆ' : 'Beside'}</option>
                    <option value="background">{isThai ? 'พื้นหลัง' : 'Background'}</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-bold mb-1 ${isThai ? 'font-mitr' : ''}`}>
                    {isThai ? 'การโต้ตอบ' : 'Interaction'}
                  </label>
                  <input
                    type="text"
                    value={interaction}
                    onChange={(e) => setInteraction(e.target.value)}
                    disabled={!editMode}
                    className={`w-full p-3 border-2 rounded-lg font-medium ${
                      editMode ? 'border-black bg-white' : 'border-gray-200 bg-gray-50'
                    } ${isThai ? 'font-mitr' : ''}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-bold mb-1 ${isThai ? 'font-mitr' : ''}`}>
                    {isThai ? 'สไตล์โฆษณา' : 'Ad Style'}
                  </label>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    disabled={!editMode}
                    className={`w-full p-3 border-2 rounded-lg font-medium ${
                      editMode ? 'border-black bg-white' : 'border-gray-200 bg-gray-50'
                    } ${isThai ? 'font-mitr' : ''}`}
                  >
                    <option value="professional">{isThai ? 'มืออาชีพ' : 'Professional'}</option>
                    <option value="luxury">{isThai ? 'หรูหรา' : 'Luxury'}</option>
                    <option value="casual">{isThai ? 'ลำลอง' : 'Casual'}</option>
                    <option value="sporty">{isThai ? 'สปอร์ต' : 'Sporty'}</option>
                    <option value="elegant">{isThai ? 'สง่างาม' : 'Elegant'}</option>
                    <option value="fun">{isThai ? 'สนุกสนาน' : 'Fun'}</option>
                    <option value="minimalist">{isThai ? 'มินิมอล' : 'Minimalist'}</option>
                    <option value="vibrant">{isThai ? 'สดใส' : 'Vibrant'}</option>
                  </select>
                </div>

                {/* Custom Prompt */}
                <div>
                  <label className={`block text-sm font-bold mb-1 ${isThai ? 'font-mitr' : ''}`}>
                    {isThai ? '✨ คำสั่งเพิ่มเติม (ถ้ามี)' : '✨ Custom Prompt (Optional)'}
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    disabled={!editMode}
                    rows={3}
                    placeholder={isThai ? 'เช่น: เพิ่มแสงแดด, พื้นหลังชายหาด, ยิ้มให้มากขึ้น...' : 'e.g., Add sunlight, beach background, bigger smile...'}
                    className={`w-full p-3 border-2 rounded-lg font-medium resize-none ${
                      editMode ? 'border-black bg-white' : 'border-gray-200 bg-gray-50'
                    } ${isThai ? 'font-mitr' : ''}`}
                  />
                  <p className={`text-xs text-gray-500 mt-1 ${isThai ? 'font-mitr' : ''}`}>
                    {isThai ? 'เพิ่มคำสั่งพิเศษสำหรับ AI ในการสร้างภาพ' : 'Add special instructions for AI image generation'}
                  </p>
                </div>

                {/* AI Suggestion Preview */}
                <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200 mt-4">
                  <p className={`text-sm font-bold text-purple-600 mb-2 ${isThai ? 'font-mitr' : ''}`}>
                    {isThai ? '💡 AI แนะนำ:' : '💡 AI Suggests:'}
                  </p>
                  <p className={`text-sm ${isThai ? 'font-mitr' : ''}`}>
                    {isThai
                      ? `วาง "${productName}" ${placement === 'hand' ? 'ในมือ' : placement === 'near face' ? 'ใกล้ใบหน้า' : placement} ของโมเดล แบบ ${interaction} ในสไตล์ ${style}`
                      : `Place "${productName}" ${placement} with model ${interaction} in ${style} style`
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => router.push("/")}
            className={`px-8 py-4 bg-gray-200 text-black border-4 border-black rounded-xl font-black text-xl hover:bg-gray-300 transition-all ${isThai ? 'font-mitr' : ''}`}
          >
            ← {isThai ? 'เปลี่ยนรูป' : 'Change Images'}
          </button>
          <button
            onClick={handleProceed}
            disabled={analyzing || !!analysisError}
            className={`px-12 py-4 bg-yellow-400 text-black border-4 border-black rounded-xl font-black text-xl hover:bg-yellow-300 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isThai ? 'font-mitr' : ''}`}
          >
            {analyzing
              ? (isThai ? 'กำลังวิเคราะห์...' : 'Analyzing...')
              : analysisError
                ? (isThai ? 'กรุณาเปลี่ยนรูปภาพ' : 'Please Change Images')
                : (isThai ? 'ไปสตูดิโอ →' : 'Go to Studio →')
            }
          </button>
        </div>
      </main>
    </div>
  );
}
