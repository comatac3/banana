import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { videoUrls, userId } = await request.json();

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: "No video URLs provided" }, { status: 400 });
    }

    // If only one video, return it directly
    if (videoUrls.length === 1) {
      return NextResponse.json({ stitchedVideoUrl: videoUrls[0] });
    }

    // For now, return a placeholder until we implement actual video stitching
    // In production, this would use ffmpeg or a video processing service
    // to concatenate the videos together

    // Temporary: Just return the first video
    // TODO: Implement actual video stitching using ffmpeg or cloud video processing service
    console.log("Video stitching requested for URLs:", videoUrls);

    return NextResponse.json({
      stitchedVideoUrl: videoUrls[0],
      note: "Video stitching feature is under development. Currently returning first segment only.",
      segmentCount: videoUrls.length
    });

  } catch (error: any) {
    console.error("Error stitching videos:", error);
    return NextResponse.json(
      { error: error.message || "Failed to stitch videos" },
      { status: 500 }
    );
  }
}
