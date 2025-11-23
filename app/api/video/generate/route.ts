import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

// Model costs in credits
const MODEL_COSTS: Record<string, number> = {
  veo3_fast: 6,
  veo3: 10,
  veo3_transition: 12,
  runway: 8,
  kling: 8,
  seedance: 6,
  grok: 8,
  hailuo_standard: 5,
  hailuo_pro: 8,
  sora2: 15,
  sora2_pro: 25,
  wan: 4,
  wan25: 6,
  sora_storyboard: 30,
};

// Helper to upload image to Supabase Storage
async function uploadImageToStorage(
  supabase: any,
  userId: string,
  base64Data: string
): Promise<string> {
  const base64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const buffer = Buffer.from(base64, 'base64');

  const compressed = await sharp(buffer)
    .resize(1280, 720, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const fileName = `video-source/${userId}/${uuidv4()}.jpg`;

  const { error } = await supabase.storage
    .from('images')
    .upload(fileName, compressed, { contentType: 'image/jpeg', upsert: true });

  if (error) throw new Error(`Failed to upload image: ${error.message}`);

  const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);
  return urlData.publicUrl;
}

export async function POST(request: NextRequest) {
  try {
    const { sourceImage, storyboardImages, transitionImages, prompt, model, aspectRatio = "16:9", duration = 5, resolution = "720p", quality = "standard" } = await request.json();

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cost = MODEL_COSTS[model] || 8;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.credits < cost) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 403 });
    }

    const KIE_API_KEY = process.env.KIE_API_KEY;
    if (!KIE_API_KEY) {
      return NextResponse.json({ error: "KIE_API_KEY is not configured" }, { status: 500 });
    }

    const videoPrompt = prompt || "A gentle camera movement with cinematic lighting.";

    let imageUrl: string | null = null;
    if (sourceImage) {
      imageUrl = await uploadImageToStorage(supabase, user.id, sourceImage);
      console.log("Uploaded image URL:", imageUrl);
    }

    // ============ VEO3 MODELS ============
    if (model === "veo3" || model === "veo3_fast") {
      const requestBody: Record<string, any> = {
        prompt: videoPrompt,
        model: model === "veo3" ? "veo3" : "veo3_fast",
        aspectRatio: aspectRatio,
        duration: duration,
        enableTranslation: true,
      };
      if (imageUrl) {
        requestBody.generationType = "FIRST_AND_LAST_FRAMES_2_VIDEO";
        requestBody.imageUrls = [imageUrl];
      }

      console.log("Veo3 request:", JSON.stringify({ ...requestBody, imageUrls: imageUrl ? ['[url]'] : undefined }, null, 2));

      const response = await fetch("https://api.kie.ai/api/v1/veo/generate", {
        method: "POST",
        headers: { "Authorization": `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      console.log("Veo3 response:", JSON.stringify(data, null, 2));

      if (!response.ok || data.code !== 200) {
        throw new Error(data.msg || data.message || "Veo3 generation failed");
      }
      return NextResponse.json({ operationId: data.data?.taskId, status: "processing", model });
    }

    // ============ RUNWAY MODEL ============
    if (model === "runway") {
      // Default resolution to 720p if not set
      const runwayQuality = resolution || "720p";

      // Validate: 1080p cannot be used with 10s duration
      if (runwayQuality === "1080p" && duration === 10) {
        return NextResponse.json({ error: "Runway: 1080p resolution cannot be used with 10s duration" }, { status: 400 });
      }

      const requestBody: Record<string, any> = {
        prompt: videoPrompt,
        duration: duration,
        quality: runwayQuality,
      };
      // aspectRatio only for text-to-video, ignored when imageUrl is present
      if (imageUrl) {
        requestBody.imageUrl = imageUrl;
      } else {
        requestBody.aspectRatio = aspectRatio;
      }

      console.log("Runway request:", JSON.stringify({ ...requestBody, imageUrl: imageUrl ? '[url]' : undefined }, null, 2));

      const response = await fetch("https://api.kie.ai/api/v1/runway/generate", {
        method: "POST",
        headers: { "Authorization": `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      console.log("Runway response:", JSON.stringify(data, null, 2));

      if (!response.ok || data.code !== 200) {
        throw new Error(data.msg || data.message || "Runway generation failed");
      }
      return NextResponse.json({ operationId: data.data?.taskId, status: "processing", model });
    }

    // ============ KLING MODEL ============
    if (model === "kling") {
      // Use the /api/v1/jobs/createTask endpoint with model and input structure
      const requestBody: Record<string, any> = {
        model: "kling/v2-1-master-image-to-video",
        input: {
          prompt: videoPrompt,
          duration: String(duration),
          aspect_ratio: aspectRatio,
        }
      };
      if (imageUrl) {
        requestBody.input.image_url = imageUrl;
      }

      console.log("Kling request:", JSON.stringify({ ...requestBody, input: { ...requestBody.input, image_url: imageUrl ? '[url]' : undefined } }, null, 2));

      const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: { "Authorization": `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const responseText = await response.text();
      console.log("Kling raw response:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Kling: Invalid response - ${responseText.substring(0, 200)}`);
      }

      if (!response.ok || (data.code && data.code !== 200)) {
        console.log("Kling error response:", JSON.stringify(data, null, 2));
        const errorMsg = data.msg || data.message || data.error || data.detail || JSON.stringify(data);
        throw new Error(`Kling: ${errorMsg}`);
      }

      const taskId = data.data?.taskId || data.taskId || data.task_id || data.id;
      if (!taskId) {
        console.log("Full Kling response (no taskId):", JSON.stringify(data, null, 2));
        throw new Error("No task ID returned from Kling API");
      }

      return NextResponse.json({ operationId: taskId, status: "processing", model });
    }

    // ============ SEEDANCE MODEL (V1 Pro Fast Image To Video) ============
    if (model === "seedance") {
      if (!imageUrl) {
        return NextResponse.json({ error: "Seedance requires an image" }, { status: 400 });
      }

      // Default resolution to 720p if not set (options: 720p, 1080p)
      const seedanceResolution = resolution || "720p";
      // Duration must be "5" or "10"
      const seedanceDuration = String(duration === 10 ? 10 : 5);

      const requestBody = {
        model: "bytedance/v1-pro-fast-image-to-video",
        input: {
          prompt: videoPrompt,
          image_url: imageUrl,
          resolution: seedanceResolution,
          duration: seedanceDuration,
        }
      };

      console.log("Seedance request:", JSON.stringify({ ...requestBody, input: { ...requestBody.input, image_url: '[url]' } }, null, 2));

      const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: { "Authorization": `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const responseText = await response.text();
      console.log("Seedance raw response:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Seedance: Invalid response - ${responseText.substring(0, 200)}`);
      }

      // Check for errors
      if (!response.ok || (data.code && data.code !== 200)) {
        console.log("Seedance error response:", JSON.stringify(data, null, 2));
        const errorMsg = data.msg || data.message || data.error || data.detail || JSON.stringify(data);
        throw new Error(`Seedance: ${errorMsg}`);
      }

      // Handle different response structures
      const taskId = data.data?.taskId || data.taskId || data.task_id || data.id;
      if (!taskId) {
        console.log("Full Seedance response (no taskId):", JSON.stringify(data, null, 2));
        throw new Error("No task ID returned from Seedance API");
      }

      return NextResponse.json({ operationId: taskId, status: "processing", model });
    }

    // ============ GROK MODEL (Image To Video) ============
    if (model === "grok") {
      if (!imageUrl) {
        return NextResponse.json({ error: "Grok requires an image" }, { status: 400 });
      }

      const requestBody = {
        model: "grok-imagine/image-to-video",
        input: {
          image_urls: [imageUrl],
          prompt: videoPrompt,
          mode: "normal", // "fun", "normal", "spicy" (spicy not supported for external images)
        }
      };

      console.log("Grok request:", JSON.stringify({ ...requestBody, input: { ...requestBody.input, image_urls: ['[url]'] } }, null, 2));

      const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: { "Authorization": `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const responseText = await response.text();
      console.log("Grok raw response:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Grok: Invalid response - ${responseText.substring(0, 200)}`);
      }

      if (!response.ok || (data.code && data.code !== 200)) {
        console.log("Grok error response:", JSON.stringify(data, null, 2));
        const errorMsg = data.msg || data.message || data.error || data.detail || JSON.stringify(data);
        throw new Error(`Grok: ${errorMsg}`);
      }

      const taskId = data.data?.taskId || data.taskId || data.task_id || data.id;
      if (!taskId) {
        console.log("Full Grok response (no taskId):", JSON.stringify(data, null, 2));
        throw new Error("No task ID returned from Grok API");
      }

      return NextResponse.json({ operationId: taskId, status: "processing", model });
    }

    // ============ HAILUO MODELS (2.3 Image To Video Standard/Pro) ============
    if (model === "hailuo_standard" || model === "hailuo_pro") {
      if (!imageUrl) {
        return NextResponse.json({ error: "Hailuo requires an image" }, { status: 400 });
      }

      // Resolution: 768P or 1080P
      const hailuoResolution = resolution === "1080P" ? "1080P" : "768P";
      // Duration: 6 or 10 (10s not supported for 1080P)
      const hailuoDuration = String(duration === 10 ? 10 : 6);

      // Validate: 1080P cannot be used with 10s duration
      if (hailuoResolution === "1080P" && hailuoDuration === "10") {
        return NextResponse.json({ error: "Hailuo: 1080P resolution cannot be used with 10s duration" }, { status: 400 });
      }

      // Select model based on standard or pro
      const hailuoModelId = model === "hailuo_pro"
        ? "hailuo/2-3-image-to-video-pro"
        : "hailuo/2-3-image-to-video-standard";

      const requestBody = {
        model: hailuoModelId,
        input: {
          prompt: videoPrompt,
          image_url: imageUrl,
          duration: hailuoDuration,
          resolution: hailuoResolution,
        }
      };

      console.log("Hailuo request:", JSON.stringify({ ...requestBody, input: { ...requestBody.input, image_url: '[url]' } }, null, 2));

      const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: { "Authorization": `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const responseText = await response.text();
      console.log("Hailuo raw response:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Hailuo: Invalid response - ${responseText.substring(0, 200)}`);
      }

      if (!response.ok || (data.code && data.code !== 200)) {
        console.log("Hailuo error response:", JSON.stringify(data, null, 2));
        const errorMsg = data.msg || data.message || data.error || data.detail || JSON.stringify(data);
        throw new Error(`Hailuo: ${errorMsg}`);
      }

      const taskId = data.data?.taskId || data.taskId || data.task_id || data.id;
      if (!taskId) {
        console.log("Full Hailuo response (no taskId):", JSON.stringify(data, null, 2));
        throw new Error("No task ID returned from Hailuo API");
      }

      return NextResponse.json({ operationId: taskId, status: "processing", model });
    }

    // ============ SORA 2 MODELS (Image To Video) ============
    if (model === "sora2" || model === "sora2_pro") {
      if (!imageUrl) {
        return NextResponse.json({ error: "Sora 2 requires an image" }, { status: 400 });
      }

      // Select model based on standard or pro
      const soraModelId = model === "sora2_pro"
        ? "sora-2-pro-image-to-video"
        : "sora-2-image-to-video";

      // Duration: n_frames = "10" or "15"
      const nFrames = String(duration === 15 ? 15 : 10);

      // Aspect ratio: "landscape" or "portrait"
      const soraAspectRatio = aspectRatio === "portrait" ? "portrait" : "landscape";

      const requestBody: Record<string, any> = {
        model: soraModelId,
        input: {
          prompt: videoPrompt,
          image_urls: [imageUrl],
          aspect_ratio: soraAspectRatio,
          n_frames: nFrames,
          remove_watermark: true,
        }
      };

      // Add size parameter only for Sora 2 Pro
      if (model === "sora2_pro") {
        requestBody.input.size = quality === "high" ? "high" : "standard";
      }

      console.log("Sora 2 request:", JSON.stringify({ ...requestBody, input: { ...requestBody.input, image_urls: ['[url]'] } }, null, 2));

      const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: { "Authorization": `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const responseText = await response.text();
      console.log("Sora 2 raw response:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Sora 2: Invalid response - ${responseText.substring(0, 200)}`);
      }

      if (!response.ok || (data.code && data.code !== 200)) {
        console.log("Sora 2 error response:", JSON.stringify(data, null, 2));
        const errorMsg = data.msg || data.message || data.error || data.detail || JSON.stringify(data);
        throw new Error(`Sora 2: ${errorMsg}`);
      }

      const taskId = data.data?.taskId || data.taskId || data.task_id || data.id;
      if (!taskId) {
        console.log("Full Sora 2 response (no taskId):", JSON.stringify(data, null, 2));
        throw new Error("No task ID returned from Sora 2 API");
      }

      return NextResponse.json({ operationId: taskId, status: "processing", model });
    }

    // ============ WAN 2.2 MODEL (Image To Video Turbo) ============
    if (model === "wan") {
      if (!imageUrl) {
        return NextResponse.json({ error: "WAN requires an image" }, { status: 400 });
      }

      // Resolution: 480p, 580p, 720p
      const wanResolution = resolution || "720p";

      // Aspect ratio: auto, 16:9, 9:16, 1:1
      const wanAspectRatio = aspectRatio || "auto";

      const requestBody = {
        model: "wan/2-2-a14b-image-to-video-turbo",
        input: {
          image_url: imageUrl,
          prompt: videoPrompt,
          resolution: wanResolution,
          aspect_ratio: wanAspectRatio,
          enable_prompt_expansion: false,
          acceleration: "none",
        }
      };

      console.log("WAN request:", JSON.stringify({ ...requestBody, input: { ...requestBody.input, image_url: '[url]' } }, null, 2));

      const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: { "Authorization": `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const responseText = await response.text();
      console.log("WAN raw response:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`WAN: Invalid response - ${responseText.substring(0, 200)}`);
      }

      if (!response.ok || (data.code && data.code !== 200)) {
        console.log("WAN error response:", JSON.stringify(data, null, 2));
        const errorMsg = data.msg || data.message || data.error || data.detail || JSON.stringify(data);
        throw new Error(`WAN: ${errorMsg}`);
      }

      const taskId = data.data?.taskId || data.taskId || data.task_id || data.id;
      if (!taskId) {
        console.log("Full WAN response (no taskId):", JSON.stringify(data, null, 2));
        throw new Error("No task ID returned from WAN API");
      }

      return NextResponse.json({ operationId: taskId, status: "processing", model });
    }

    // ============ WAN 2.5 MODEL (Image To Video HD) ============
    if (model === "wan25") {
      if (!imageUrl) {
        return NextResponse.json({ error: "WAN 2.5 requires an image" }, { status: 400 });
      }

      // Resolution: 720p or 1080p
      const wan25Resolution = resolution === "720p" ? "720p" : "1080p";
      // Duration: 5 or 10
      const wan25Duration = String(duration === 10 ? 10 : 5);

      const requestBody = {
        model: "wan/2-5-image-to-video",
        input: {
          prompt: videoPrompt,
          image_url: imageUrl,
          duration: wan25Duration,
          resolution: wan25Resolution,
          enable_prompt_expansion: true,
        }
      };

      console.log("WAN 2.5 request:", JSON.stringify({ ...requestBody, input: { ...requestBody.input, image_url: '[url]' } }, null, 2));

      const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: { "Authorization": `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const responseText = await response.text();
      console.log("WAN 2.5 raw response:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`WAN 2.5: Invalid response - ${responseText.substring(0, 200)}`);
      }

      if (!response.ok || (data.code && data.code !== 200)) {
        console.log("WAN 2.5 error response:", JSON.stringify(data, null, 2));
        const errorMsg = data.msg || data.message || data.error || data.detail || JSON.stringify(data);
        throw new Error(`WAN 2.5: ${errorMsg}`);
      }

      const taskId = data.data?.taskId || data.taskId || data.task_id || data.id;
      if (!taskId) {
        console.log("Full WAN 2.5 response (no taskId):", JSON.stringify(data, null, 2));
        throw new Error("No task ID returned from WAN 2.5 API");
      }

      return NextResponse.json({ operationId: taskId, status: "processing", model });
    }

    // ============ SORA 2 STORYBOARD MODEL ============
    if (model === "sora_storyboard") {
      if (!storyboardImages || storyboardImages.length < 2) {
        return NextResponse.json({ error: "Storyboard requires at least 2 images" }, { status: 400 });
      }

      // Upload all storyboard images
      const uploadedUrls: string[] = [];
      for (const img of storyboardImages) {
        const url = await uploadImageToStorage(supabase, user.id, img);
        uploadedUrls.push(url);
      }

      console.log("Uploaded storyboard images:", uploadedUrls.length);

      // Duration: n_frames = "10", "15", or "25"
      const nFrames = String(duration === 25 ? 25 : duration === 15 ? 15 : 10);

      // Aspect ratio: "landscape" or "portrait"
      const storyboardAspectRatio = aspectRatio === "portrait" ? "portrait" : "landscape";

      // Build shots array - each image becomes a shot with optional prompt
      const shots = uploadedUrls.map((url, index) => ({
        image_url: url,
        prompt: index === 0 ? videoPrompt : "", // Use main prompt for first shot
      }));

      const requestBody = {
        model: "sora-2-pro-storyboard",
        input: {
          n_frames: nFrames,
          shots: shots,
          aspect_ratio: storyboardAspectRatio,
        }
      };

      console.log("Sora Storyboard request:", JSON.stringify({ ...requestBody, input: { ...requestBody.input, shots: `[${shots.length} shots]` } }, null, 2));

      const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: { "Authorization": `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const responseText = await response.text();
      console.log("Sora Storyboard raw response:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Sora Storyboard: Invalid response - ${responseText.substring(0, 200)}`);
      }

      if (!response.ok || (data.code && data.code !== 200)) {
        console.log("Sora Storyboard error response:", JSON.stringify(data, null, 2));
        const errorMsg = data.msg || data.message || data.error || data.detail || JSON.stringify(data);
        throw new Error(`Sora Storyboard: ${errorMsg}`);
      }

      const taskId = data.data?.taskId || data.taskId || data.task_id || data.id;
      if (!taskId) {
        console.log("Full Sora Storyboard response (no taskId):", JSON.stringify(data, null, 2));
        throw new Error("No task ID returned from Sora Storyboard API");
      }

      return NextResponse.json({ operationId: taskId, status: "processing", model });
    }

    // ============ VEO3 TRANSITION MODEL (First and Last Frame to Video) ============
    if (model === "veo3_transition") {
      if (!transitionImages || !transitionImages.first || !transitionImages.last) {
        return NextResponse.json({ error: "Veo3 Transition requires both first and last frame images" }, { status: 400 });
      }

      // Upload both transition images
      const firstImageUrl = await uploadImageToStorage(supabase, user.id, transitionImages.first);
      const lastImageUrl = await uploadImageToStorage(supabase, user.id, transitionImages.last);

      console.log("Uploaded transition images - first:", firstImageUrl ? '[url]' : 'none', "last:", lastImageUrl ? '[url]' : 'none');

      const requestBody = {
        prompt: videoPrompt,
        model: "veo3", // Use veo3 model with transition generation type
        aspectRatio: aspectRatio,
        duration: 8,
        generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
        imageUrls: [firstImageUrl, lastImageUrl], // First frame, then last frame
        enableTranslation: true,
      };

      console.log("Veo3 Transition request:", JSON.stringify({ ...requestBody, imageUrls: ['[first]', '[last]'] }, null, 2));

      const response = await fetch("https://api.kie.ai/api/v1/veo/generate", {
        method: "POST",
        headers: { "Authorization": `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      console.log("Veo3 Transition response:", JSON.stringify(data, null, 2));

      if (!response.ok || data.code !== 200) {
        throw new Error(data.msg || data.message || "Veo3 Transition generation failed");
      }

      return NextResponse.json({ operationId: data.data?.taskId, status: "processing", model });
    }

    return NextResponse.json({ error: `Model ${model} is not supported` }, { status: 400 });

  } catch (error: any) {
    console.error("Error generating video:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate video.", details: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
