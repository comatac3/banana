import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

async function downloadVideo(url: string, filepath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download video: ${url}`);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(buffer));
}

export async function POST(request: NextRequest) {
  const tempDir = "/tmp/video-stitch-" + uuidv4();

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

    // Create temp directory
    fs.mkdirSync(tempDir, { recursive: true });

    // Download all video segments
    console.log(`Downloading ${videoUrls.length} video segments...`);
    const downloadPromises = videoUrls.map((url, index) => {
      const filepath = path.join(tempDir, `segment_${index}.mp4`);
      return downloadVideo(url, filepath);
    });
    await Promise.all(downloadPromises);

    // Create concat file for ffmpeg
    const concatFilePath = path.join(tempDir, "concat.txt");
    const concatContent = videoUrls.map((_, index) =>
      `file 'segment_${index}.mp4'`
    ).join("\n");
    fs.writeFileSync(concatFilePath, concatContent);

    // Stitch videos using ffmpeg
    const outputPath = path.join(tempDir, "stitched.mp4");
    console.log("Stitching videos with ffmpeg...");

    try {
      await execPromise(
        `ffmpeg -f concat -safe 0 -i ${concatFilePath} -c copy ${outputPath}`
      );
    } catch (error: any) {
      // If copy codec fails, try re-encoding
      console.log("Copy codec failed, re-encoding...");
      await execPromise(
        `ffmpeg -f concat -safe 0 -i ${concatFilePath} -c:v libx264 -c:a aac ${outputPath}`
      );
    }

    // Read stitched video
    const stitchedBuffer = fs.readFileSync(outputPath);

    // Upload to Supabase storage
    const fileName = `stitched-videos/${userId}/${uuidv4()}.mp4`;
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(fileName, stitchedBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });

    if (uploadError) throw new Error(`Failed to upload stitched video: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);

    console.log(`Successfully stitched ${videoUrls.length} segments`);

    return NextResponse.json({
      stitchedVideoUrl: urlData.publicUrl,
      segmentCount: videoUrls.length
    });

  } catch (error: any) {
    console.error("Error stitching videos:", error);
    return NextResponse.json(
      { error: error.message || "Failed to stitch videos" },
      { status: 500 }
    );
  } finally {
    // Cleanup temp files
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error("Error cleaning up temp files:", cleanupError);
    }
  }
}
