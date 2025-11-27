import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Cost for extending a video (same as veo3 generation)
const VEO3_EXTEND_COST = 10;

export async function POST(request: NextRequest) {
  try {
    const { taskId, prompt, seeds, watermark } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
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

    if (profileError || !profile || profile.credits < VEO3_EXTEND_COST) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 403 });
    }

    const KIE_API_KEY = process.env.KIE_API_KEY;
    if (!KIE_API_KEY) {
      return NextResponse.json({ error: "KIE_API_KEY is not configured" }, { status: 500 });
    }

    // Build request body for Veo3 extend API
    const requestBody: Record<string, any> = {
      taskId: taskId,
      prompt: prompt,
    };

    // Optional parameters
    if (seeds !== undefined) {
      // Validate seeds range: 10000-99999
      if (seeds < 10000 || seeds > 99999) {
        return NextResponse.json({ error: "seeds must be between 10000 and 99999" }, { status: 400 });
      }
      requestBody.seeds = seeds;
    }

    if (watermark) {
      requestBody.watermark = watermark;
    }

    console.log("Veo3 extend request:", JSON.stringify(requestBody, null, 2));

    const response = await fetch("https://api.kie.ai/api/v1/veo/extend", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KIE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    console.log("Veo3 extend response:", JSON.stringify(data, null, 2));

    // Handle error responses
    if (!response.ok || data.code !== 200) {
      const errorMessage = data.msg || data.message || "Video extension failed";

      // Map error codes to user-friendly messages
      const errorMessages: Record<number, string> = {
        400: "Content policy violation or invalid input",
        401: "Authentication failed",
        402: "Insufficient credits",
        404: "Original video not found",
        422: "Invalid parameters",
        429: "Rate limit exceeded",
        455: "Service under maintenance",
        500: "Server error",
        501: "Extension failed",
        505: "Feature disabled",
      };

      return NextResponse.json(
        { error: errorMessages[data.code] || errorMessage },
        { status: data.code >= 500 ? 500 : 400 }
      );
    }

    // Return the new task ID for the extended video
    return NextResponse.json({
      operationId: data.data?.taskId,
      status: "processing",
      model: "veo3_extend",
      originalTaskId: taskId,
    });

  } catch (error: any) {
    console.error("Error extending video:", error);
    return NextResponse.json(
      { error: error.message || "Failed to extend video" },
      { status: 500 }
    );
  }
}
