import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Helper to save video asset to database
async function saveVideoAsset(
  supabase: any,
  userId: string,
  videoUrl: string,
  model: string,
  prompt?: string
) {
  try {
    const { error } = await supabase
      .from('assets')
      .insert({
        user_id: userId,
        type: 'video',
        url: videoUrl,
        thumbnail_url: null,
        prompt: prompt || '',
        model: model,
        metadata: { source: 'kie.ai' }
      });

    if (error) {
      console.error("Failed to save video asset:", error);
    }
  } catch (e) {
    console.error("Error saving video asset:", e);
  }
}

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

const STATUS_ENDPOINTS: Record<string, string> = {
  veo3: "https://api.kie.ai/api/v1/veo/record-info",
  veo3_fast: "https://api.kie.ai/api/v1/veo/record-info",
  veo3_transition: "https://api.kie.ai/api/v1/veo/record-info",
  runway: "https://api.kie.ai/api/v1/runway/record-detail",
  kling: "https://api.kie.ai/api/v1/jobs/recordInfo",
  seedance: "https://api.kie.ai/api/v1/jobs/recordInfo",
  grok: "https://api.kie.ai/api/v1/jobs/recordInfo",
  hailuo_standard: "https://api.kie.ai/api/v1/jobs/recordInfo",
  hailuo_pro: "https://api.kie.ai/api/v1/jobs/recordInfo",
  sora2: "https://api.kie.ai/api/v1/jobs/recordInfo",
  sora2_pro: "https://api.kie.ai/api/v1/jobs/recordInfo",
  wan: "https://api.kie.ai/api/v1/jobs/recordInfo",
  wan25: "https://api.kie.ai/api/v1/jobs/recordInfo",
  sora_storyboard: "https://api.kie.ai/api/v1/jobs/recordInfo",
};

async function deductCredits(supabase: any, userId: string, cost: number) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single();

  if (profile) {
    await supabase
      .from('profiles')
      .update({ credits: profile.credits - cost })
      .eq('id', userId);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const operationId = searchParams.get("operationId");
    const model = searchParams.get("model") || "veo3_fast";

    if (!operationId) {
      return NextResponse.json({ error: "Operation ID is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const KIE_API_KEY = process.env.KIE_API_KEY;
    if (!KIE_API_KEY) {
      return NextResponse.json({ error: "KIE_API_KEY is not configured" }, { status: 500 });
    }

    const statusEndpoint = STATUS_ENDPOINTS[model];
    if (!statusEndpoint) {
      return NextResponse.json({ error: "Model not supported" }, { status: 400 });
    }

    // All use query parameter with taskId
    const statusUrl = `${statusEndpoint}?taskId=${encodeURIComponent(operationId)}`;

    const statusResponse = await fetch(
      statusUrl,
      {
        method: "GET",
        headers: { "Authorization": `Bearer ${KIE_API_KEY}` },
      }
    );

    const data = await statusResponse.json();
    console.log(`${model} status:`, JSON.stringify(data, null, 2));

    if (!statusResponse.ok) {
      return NextResponse.json(
        { error: data.msg || "Failed to check status" },
        { status: statusResponse.status }
      );
    }

    // Parse response - handle multiple possible structures
    const taskData = data.data || data;

    // Get status flag - different models use different fields
    // Veo3: successFlag (0=processing, 1=success, 2/3=failed)
    // Runway: state ("wait", "queueing", "generating", "success", "fail")
    // Seedance: successFlag or status
    const successFlag = taskData.successFlag ?? taskData.status ?? taskData.state;

    // Check multiple locations for video URLs
    // Veo3: data.response.resultUrls[0]
    // Runway: data.videoInfo.videoUrl
    // Kling: data.resultJson (JSON string) -> resultUrls[0]
    let klingResultUrl = null;
    if (taskData.resultJson) {
      try {
        const resultJson = JSON.parse(taskData.resultJson);
        klingResultUrl = resultJson.resultUrls?.[0];
      } catch (e) {
        console.log("Failed to parse Kling resultJson:", taskData.resultJson);
      }
    }

    const resultUrls = taskData.response?.resultUrls || taskData.resultUrls || taskData.videoUrls || taskData.videos || [];
    const videoUrl =
      klingResultUrl ||  // Kling specific
      taskData.response?.resultUrls?.[0] ||
      taskData.videoInfo?.videoUrl ||  // Runway specific
      taskData.videoUrl ||
      taskData.video_url ||
      taskData.url ||
      taskData.output?.video ||
      (resultUrls.length > 0 ? resultUrls[0] : null);

    console.log("Parsed status - successFlag:", successFlag, "videoUrl:", videoUrl ? "[found]" : "[not found]");

    // Completed - check various success indicators
    const isCompleted = successFlag === 1 || successFlag === "1" ||
                        successFlag === "completed" || successFlag === "success" ||
                        successFlag === "done" || successFlag === "finished";

    if (isCompleted && videoUrl) {
      await deductCredits(supabase, user.id, MODEL_COSTS[model] || 8);
      // Save video to assets
      saveVideoAsset(supabase, user.id, videoUrl, model);
      return NextResponse.json({ status: "completed", videoUrl });
    }

    // Also check if video URL exists even without explicit success flag
    if (videoUrl && !successFlag) {
      await deductCredits(supabase, user.id, MODEL_COSTS[model] || 8);
      // Save video to assets
      saveVideoAsset(supabase, user.id, videoUrl, model);
      return NextResponse.json({ status: "completed", videoUrl });
    }

    // Failed
    const isFailed = successFlag === 2 || successFlag === 3 || successFlag === "2" || successFlag === "3" ||
                     successFlag === "failed" || successFlag === "error" || successFlag === "fail";

    if (isFailed) {
      return NextResponse.json({
        status: "failed",
        error: taskData.failReason || taskData.failMsg || taskData.errorMsg || taskData.error || taskData.message || "Video generation failed",
      });
    }

    // Processing
    return NextResponse.json({ status: "processing" });

  } catch (error: any) {
    console.error("Error checking video status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check status" },
      { status: 500 }
    );
  }
}
