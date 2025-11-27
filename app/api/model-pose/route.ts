import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/utils/supabase/server";
import { v4 as uuidv4 } from "uuid";

const POSE_COST = 2; // Credits per pose generation

// Helper to strip the data:image/xxx;base64, prefix
const cleanBase64 = (dataUrl: string) => {
  return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
};

// Helper to save generated image
async function saveImageAsset(
  supabase: any,
  userId: string,
  base64Data: string,
  prompt: string
): Promise<string | null> {
  try {
    const base64 = cleanBase64(base64Data);
    const buffer = Buffer.from(base64, 'base64');
    const fileName = `model-pose/${userId}/${uuidv4()}.png`;

    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: true });

    if (uploadError) {
      console.error("Failed to upload image:", uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    await supabase.from('assets').insert({
      user_id: userId,
      type: 'image',
      url: imageUrl,
      thumbnail_url: imageUrl,
      prompt: prompt,
      model: 'gemini-model-pose',
      metadata: { feature: 'model-pose' }
    });

    return imageUrl;
  } catch (e) {
    console.error("Error saving image:", e);
    return null;
  }
}

// Predefined pose categories
const POSE_PROMPTS: Record<string, string> = {
  // Standing poses
  "standing-casual": "standing casually with relaxed posture, one hand in pocket, natural smile",
  "standing-confident": "standing confidently with hands on hips, powerful stance, looking at camera",
  "standing-crossed-arms": "standing with arms crossed, professional look, confident expression",
  "standing-lean": "leaning against a wall casually, relaxed pose, cool attitude",

  // Sitting poses
  "sitting-casual": "sitting casually on a chair, relaxed posture, friendly expression",
  "sitting-professional": "sitting professionally at a desk, business-like pose, confident",
  "sitting-floor": "sitting on the floor cross-legged, relaxed and comfortable",
  "sitting-couch": "sitting comfortably on a couch, casual and relaxed pose",

  // Action poses
  "walking": "walking naturally, mid-stride pose, dynamic movement",
  "running": "running pose, athletic and dynamic, action shot",
  "jumping": "jumping in the air, energetic pose, joyful expression",
  "dancing": "dancing pose, expressive movement, having fun",

  // Gesture poses
  "waving": "waving hello with one hand, friendly greeting pose",
  "thumbs-up": "giving thumbs up, positive expression, encouraging pose",
  "peace-sign": "making peace sign with fingers, playful pose",
  "pointing": "pointing at camera or to the side, engaging pose",

  // Professional poses
  "presenting": "presenting or gesturing as if explaining something, professional",
  "thinking": "thinking pose with hand on chin, contemplative expression",
  "working": "working on laptop or phone, focused and productive",
  "holding-product": "holding a product naturally, advertisement style pose",

  // Social media poses
  "selfie": "selfie pose, phone at angle, social media ready",
  "mirror-selfie": "mirror selfie pose, full body visible, trendy",
  "candid": "candid natural moment, not looking at camera, authentic",
  "laughing": "laughing genuinely, joyful expression, candid moment",

  // Fashion poses
  "model-pose": "high fashion model pose, editorial style, striking",
  "runway": "runway walk pose, elegant and confident, fashion forward",
  "casual-fashion": "casual fashion pose, stylish but relaxed",
  "street-style": "street style fashion pose, urban and trendy",
};

export async function POST(request: NextRequest) {
  try {
    const { avatarImage, poseId, customPose, referenceImage } = await request.json();

    if (!avatarImage) {
      return NextResponse.json({ error: "Avatar image is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check credits
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.credits < POSE_COST) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 403 });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Build the pose description
    let poseDescription = "";
    if (customPose) {
      poseDescription = customPose;
    } else if (poseId && POSE_PROMPTS[poseId]) {
      poseDescription = POSE_PROMPTS[poseId];
    } else {
      poseDescription = "natural standing pose, looking at camera";
    }

    // Build the prompt
    const hasReference = referenceImage && referenceImage.length > 0;
    const imagePrompt = `TRANSFORM THIS PERSON INTO A NEW POSE:

SOURCE IMAGE (Image 1): This is the person/model. Keep their EXACT face, skin tone, hair color, hair style, and body type.
${hasReference ? `REFERENCE POSE (Image 2): This shows the EXACT pose and body position to replicate. Match this pose precisely.` : ''}

REQUESTED POSE: ${poseDescription}

REQUIREMENTS:
1. Keep the person's identity EXACTLY the same (same face, same features)
2. Change ONLY their pose/posture to: ${poseDescription}
3. ${hasReference ? 'Match the pose from the reference image as closely as possible' : 'Create a natural, realistic pose'}
4. Maintain similar clothing style or dress them appropriately for the pose
5. Use a clean, professional background (solid color or simple gradient)
6. Ensure proper lighting and shadows for the new pose
7. The result should look like a professional photo shoot

OUTPUT: A single high-quality image of the same person in the new pose.`;

    console.log("Model Pose - Generating with pose:", poseDescription);

    // Build parts array
    const parts: any[] = [
      {
        inlineData: {
          mimeType: "image/png",
          data: cleanBase64(avatarImage),
        },
      },
    ];

    // Add reference image if provided
    if (hasReference) {
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: cleanBase64(referenceImage),
        },
      });
    }

    parts.push({ text: imagePrompt });

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: { parts },
    });

    // Extract image from response
    let generatedImageData: string | null = null;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if ((part as any).inlineData) {
        const inlineData = (part as any).inlineData;
        generatedImageData = `data:${inlineData.mimeType};base64,${inlineData.data}`;
        break;
      }
    }

    if (!generatedImageData) {
      console.error("No image in response:", JSON.stringify(response.candidates?.[0]?.content?.parts, null, 2));
      throw new Error("No image generated");
    }

    // Deduct credits
    await supabase
      .from('profiles')
      .update({ credits: profile.credits - POSE_COST })
      .eq('id', user.id);

    // Save to assets (async)
    saveImageAsset(supabase, user.id, generatedImageData, `Model Pose: ${poseDescription}`);

    return NextResponse.json({
      generatedImage: generatedImageData,
      credits: profile.credits - POSE_COST,
    });

  } catch (error: any) {
    console.error("Model Pose error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate pose" },
      { status: 500 }
    );
  }
}

// GET endpoint to return available poses
export async function GET() {
  const poses = Object.entries(POSE_PROMPTS).map(([id, description]) => ({
    id,
    name: id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    description,
    category: id.split('-')[0],
  }));

  const categories = [...new Set(poses.map(p => p.category))];

  return NextResponse.json({ poses, categories });
}
