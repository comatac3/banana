import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

interface TimelineClip {
    id: string;
    type: 'video' | 'image' | 'audio';
    url: string;
    thumbnailUrl?: string;
    duration: number;
    startTime: number;
}

async function downloadFile(url: string, filepath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${url}`);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(buffer));
}

export async function POST(request: NextRequest) {
  const tempDir = "/tmp/video-compose-" + uuidv4();

  try {
    const { clips, userId } = await request.json();

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!clips || !Array.isArray(clips) || clips.length === 0) {
      return NextResponse.json({ error: "No clips provided" }, { status: 400 });
    }

    // Check credits
    const totalDuration = clips.reduce((sum: number, clip: TimelineClip) => sum + clip.duration, 0);
    const cost = Math.max(5, Math.ceil(totalDuration / 60) * 5);

    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    if (!profile || profile.credits < cost) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 403 });
    }

    // Create temp directory
    fs.mkdirSync(tempDir, { recursive: true });

    console.log(`Processing ${clips.length} clips...`);

    // Process each clip
    const processedClips: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const clip: TimelineClip = clips[i];
      const outputPath = path.join(tempDir, `clip_${i}.mp4`);

      if (clip.type === 'video') {
        // Download video
        const videoPath = path.join(tempDir, `download_${i}.mp4`);
        await downloadFile(clip.url, videoPath);

        // Trim to specified duration
        await execPromise(
          `ffmpeg -i ${videoPath} -t ${clip.duration} -c copy ${outputPath}`
        );
      } else if (clip.type === 'image') {
        // Download image
        const imagePath = path.join(tempDir, `image_${i}.jpg`);
        await downloadFile(clip.url, imagePath);

        // Create video from image with specified duration
        await execPromise(
          `ffmpeg -loop 1 -i ${imagePath} -c:v libx264 -t ${clip.duration} -pix_fmt yuv420p -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" ${outputPath}`
        );
      }

      processedClips.push(outputPath);
    }

    // Create concat file
    const concatFilePath = path.join(tempDir, "concat.txt");
    const concatContent = processedClips.map((p, i) =>
      `file 'clip_${i}.mp4'`
    ).join("\n");
    fs.writeFileSync(concatFilePath, concatContent);

    // Concatenate all clips
    const finalOutputPath = path.join(tempDir, "final.mp4");
    console.log("Concatenating clips...");

    try {
      await execPromise(
        `ffmpeg -f concat -safe 0 -i ${concatFilePath} -c copy ${finalOutputPath}`
      );
    } catch (error) {
      // Fallback: re-encode if copy fails
      console.log("Copy failed, re-encoding...");
      await execPromise(
        `ffmpeg -f concat -safe 0 -i ${concatFilePath} -c:v libx264 -c:a aac ${finalOutputPath}`
      );
    }

    // Read final video
    const finalBuffer = fs.readFileSync(finalOutputPath);

    // Upload to Supabase
    const fileName = `composed-videos/${userId}/${uuidv4()}.mp4`;
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(fileName, finalBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);

    // Deduct credits
    await supabase
      .from('profiles')
      .update({ credits: profile.credits - cost })
      .eq('id', userId);

    // Save to assets
    await supabase
      .from('assets')
      .insert({
        user_id: userId,
        type: 'video',
        url: urlData.publicUrl,
        thumbnail_url: null,
        prompt: `Edited video - ${clips.length} clips, ${totalDuration}s`,
        model: 'editor',
        metadata: {
          source: 'editor',
          clipCount: clips.length,
          duration: totalDuration
        }
      });

    console.log(`Successfully composed video with ${clips.length} clips`);

    return NextResponse.json({
      videoUrl: urlData.publicUrl,
      clipCount: clips.length,
      duration: totalDuration,
      cost
    });

  } catch (error: any) {
    console.error("Error composing video:", error);
    return NextResponse.json(
      { error: error.message || "Failed to compose video" },
      { status: 500 }
    );
  } finally {
    // Cleanup
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }
  }
}
