import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

interface FramePair {
  video1Frame: number;
  video1Time: number;
  video2Frame: number;
  video2Time: number;
  psnr: number;
  ssim: number;
  mse: number;
  combinedScore: number;
}

async function downloadFile(url: string, filepath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${url}`);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(buffer));
}

async function getVideoInfo(videoPath: string): Promise<VideoInfo> {
  try {
    const { stdout } = await execPromise(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -show_entries format=duration -of json "${videoPath}"`
    );
    const info = JSON.parse(stdout);
    const stream = info.streams?.[0] || {};
    const format = info.format || {};

    let fps = 30;
    if (stream.r_frame_rate) {
      const parts = stream.r_frame_rate.split('/');
      fps = parts.length === 2 ? parseInt(parts[0]) / parseInt(parts[1]) : parseFloat(stream.r_frame_rate);
    }

    return {
      duration: parseFloat(format.duration || '5'),
      width: parseInt(stream.width || '1920'),
      height: parseInt(stream.height || '1080'),
      fps: fps
    };
  } catch (e) {
    return { duration: 5, width: 1920, height: 1080, fps: 30 };
  }
}

async function compareFrames(frame1Path: string, frame2Path: string): Promise<{ psnr: number; ssim: number; mse: number }> {
  let psnr = 0, ssim = 0, mse = 999999;

  // PSNR + MSE
  try {
    let output = '';
    try {
      const result = await execPromise(
        `ffmpeg -i "${frame1Path}" -i "${frame2Path}" -lavfi "psnr" -f null /dev/null 2>&1`
      );
      output = (result.stdout || '') + (result.stderr || '');
    } catch (e: any) {
      output = (e.stdout || '') + (e.stderr || '');
    }

    if (output.includes('average:inf')) {
      psnr = 100;
      mse = 0;
    } else {
      const psnrMatch = output.match(/average:([\d.]+)/);
      if (psnrMatch) psnr = parseFloat(psnrMatch[1]);
      const mseMatch = output.match(/mse_avg:([\d.]+)/);
      if (mseMatch) mse = parseFloat(mseMatch[1]);
    }
  } catch (e) {}

  // SSIM
  try {
    let output = '';
    try {
      const result = await execPromise(
        `ffmpeg -i "${frame1Path}" -i "${frame2Path}" -lavfi "ssim" -f null /dev/null 2>&1`
      );
      output = (result.stdout || '') + (result.stderr || '');
    } catch (e: any) {
      output = (e.stdout || '') + (e.stderr || '');
    }
    const match = output.match(/All:([\d.]+)/);
    if (match) ssim = parseFloat(match[1]);
  } catch (e) {}

  return { psnr, ssim, mse };
}

// Analyze and find best cut points for BOTH videos
async function analyzeSmartCutBidirectional(
  tempDir: string,
  video1Path: string,
  video2Path: string,
  searchDuration: number = 3
): Promise<{
  video1TrimEnd: number;  // How much to trim from end of video1 (in seconds from start)
  video2TrimStart: number; // How much to trim from start of video2
  confidence: string;
  score: number;
  details: { psnr: number; ssim: number; mse: number };
}> {
  const framesDir = path.join(tempDir, 'frames');
  const video1FramesDir = path.join(framesDir, 'video1');
  const video2FramesDir = path.join(framesDir, 'video2');

  fs.mkdirSync(video1FramesDir, { recursive: true });
  fs.mkdirSync(video2FramesDir, { recursive: true });

  try {
    console.log('\n🎬 Bidirectional Smart Cut Analysis Starting...');

    // Get video info
    const video1Info = await getVideoInfo(video1Path);
    const video2Info = await getVideoInfo(video2Path);

    console.log(`  Video 1: ${video1Info.duration.toFixed(2)}s`);
    console.log(`  Video 2: ${video2Info.duration.toFixed(2)}s`);

    const v1SearchDuration = Math.min(searchDuration, video1Info.duration);
    const v2SearchDuration = Math.min(searchDuration, video2Info.duration);

    // PHASE 1: Extract frames from end of video1 and start of video2
    console.log('  Phase 1: Extracting frames...');
    const coarseFps = 10;

    // Extract last N seconds of video1
    const v1StartTime = Math.max(0, video1Info.duration - v1SearchDuration);
    await execPromise(
      `ffmpeg -y -ss ${v1StartTime} -i "${video1Path}" -vf "fps=${coarseFps},scale=320:180:flags=lanczos" -q:v 1 "${video1FramesDir}/v1_%04d.png" 2>/dev/null`
    );

    // Extract first N seconds of video2
    await execPromise(
      `ffmpeg -y -i "${video2Path}" -vf "fps=${coarseFps},scale=320:180:flags=lanczos" -t ${v2SearchDuration} -q:v 1 "${video2FramesDir}/v2_%04d.png" 2>/dev/null`
    );

    const v1Frames = fs.readdirSync(video1FramesDir).filter(f => f.endsWith('.png')).sort();
    const v2Frames = fs.readdirSync(video2FramesDir).filter(f => f.endsWith('.png')).sort();

    console.log(`  Video 1 frames: ${v1Frames.length} (from ${v1StartTime.toFixed(2)}s)`);
    console.log(`  Video 2 frames: ${v2Frames.length}`);

    if (v1Frames.length === 0 || v2Frames.length === 0) {
      return {
        video1TrimEnd: video1Info.duration,
        video2TrimStart: 0,
        confidence: 'NONE',
        score: 0,
        details: { psnr: 0, ssim: 0, mse: 0 }
      };
    }

    // PHASE 2: Compare all frame pairs (coarse search)
    console.log('  Phase 2: Comparing frame pairs...');
    const framePairs: FramePair[] = [];

    // Compare every Nth frame to speed up (sample every 2nd frame)
    const sampleRate = 2;
    for (let i = 0; i < v1Frames.length; i += sampleRate) {
      for (let j = 0; j < v2Frames.length; j += sampleRate) {
        const v1FramePath = path.join(video1FramesDir, v1Frames[i]);
        const v2FramePath = path.join(video2FramesDir, v2Frames[j]);

        const { psnr, ssim, mse } = await compareFrames(v1FramePath, v2FramePath);

        const normPsnr = Math.min(psnr / 50, 1);
        const normMse = Math.max(0, 1 - (mse / 10000));
        const combinedScore = (normPsnr * 0.3) + (ssim * 0.5) + (normMse * 0.2);

        framePairs.push({
          video1Frame: i,
          video1Time: v1StartTime + (i / coarseFps),
          video2Frame: j,
          video2Time: j / coarseFps,
          psnr,
          ssim,
          mse,
          combinedScore
        });
      }
    }

    // Sort by score and get top candidates
    framePairs.sort((a, b) => b.combinedScore - a.combinedScore);
    const topCandidates = framePairs.slice(0, 5);

    console.log(`  Top candidates:`);
    topCandidates.forEach((c, idx) => {
      console.log(`    ${idx + 1}. V1@${c.video1Time.toFixed(2)}s - V2@${c.video2Time.toFixed(2)}s (Score: ${c.combinedScore.toFixed(4)})`);
    });

    // PHASE 3: Fine search around best candidate
    if (topCandidates.length > 0 && topCandidates[0].combinedScore > 0.2) {
      console.log('  Phase 3: Fine search (30fps)...');
      const bestCoarse = topCandidates[0];
      const fineFps = 30;
      const fineRadius = 0.3; // 300ms around best match

      const fineV1Dir = path.join(framesDir, 'fine_v1');
      const fineV2Dir = path.join(framesDir, 'fine_v2');
      fs.mkdirSync(fineV1Dir, { recursive: true });
      fs.mkdirSync(fineV2Dir, { recursive: true });

      // Extract fine frames from video1
      const fineV1Start = Math.max(0, bestCoarse.video1Time - fineRadius);
      const fineV1Duration = Math.min(fineRadius * 2, video1Info.duration - fineV1Start);
      await execPromise(
        `ffmpeg -y -ss ${fineV1Start} -i "${video1Path}" -vf "fps=${fineFps},scale=320:180:flags=lanczos" -t ${fineV1Duration} -q:v 1 "${fineV1Dir}/f1_%04d.png" 2>/dev/null`
      );

      // Extract fine frames from video2
      const fineV2Start = Math.max(0, bestCoarse.video2Time - fineRadius);
      const fineV2Duration = Math.min(fineRadius * 2, video2Info.duration - fineV2Start);
      await execPromise(
        `ffmpeg -y -ss ${fineV2Start} -i "${video2Path}" -vf "fps=${fineFps},scale=320:180:flags=lanczos" -t ${fineV2Duration} -q:v 1 "${fineV2Dir}/f2_%04d.png" 2>/dev/null`
      );

      const fineV1Frames = fs.readdirSync(fineV1Dir).filter(f => f.endsWith('.png')).sort();
      const fineV2Frames = fs.readdirSync(fineV2Dir).filter(f => f.endsWith('.png')).sort();

      const finePairs: FramePair[] = [];

      for (let i = 0; i < fineV1Frames.length; i++) {
        for (let j = 0; j < fineV2Frames.length; j++) {
          const v1FramePath = path.join(fineV1Dir, fineV1Frames[i]);
          const v2FramePath = path.join(fineV2Dir, fineV2Frames[j]);

          const { psnr, ssim, mse } = await compareFrames(v1FramePath, v2FramePath);

          const normPsnr = Math.min(psnr / 50, 1);
          const normMse = Math.max(0, 1 - (mse / 10000));
          const combinedScore = (normPsnr * 0.3) + (ssim * 0.5) + (normMse * 0.2);

          finePairs.push({
            video1Frame: i,
            video1Time: fineV1Start + (i / fineFps),
            video2Frame: j,
            video2Time: fineV2Start + (j / fineFps),
            psnr,
            ssim,
            mse,
            combinedScore
          });
        }
      }

      if (finePairs.length > 0) {
        finePairs.sort((a, b) => b.combinedScore - a.combinedScore);
        const bestFine = finePairs[0];

        if (bestFine.combinedScore > bestCoarse.combinedScore) {
          topCandidates[0] = bestFine;
          console.log(`  Fine search improved: ${bestFine.combinedScore.toFixed(4)} (was ${bestCoarse.combinedScore.toFixed(4)})`);
        }
      }
    }

    // Get best result
    const best = topCandidates[0];

    let finalConfidence = 'NONE';
    if (best.combinedScore >= 0.7) finalConfidence = 'EXCELLENT';
    else if (best.combinedScore >= 0.55) finalConfidence = 'VERY_GOOD';
    else if (best.combinedScore >= 0.45) finalConfidence = 'GOOD';
    else if (best.combinedScore >= 0.35) finalConfidence = 'ACCEPTABLE';
    else if (best.combinedScore >= 0.25) finalConfidence = 'MARGINAL';

    // Calculate trim points
    let video1TrimEnd = video1Info.duration; // Default: no trim (use full video)
    let video2TrimStart = 0; // Default: no trim

    if (best.combinedScore >= 0.25) {
      video1TrimEnd = best.video1Time; // Trim video1 to end at this point
      video2TrimStart = best.video2Time; // Trim video2 to start at this point
    }

    console.log(`\n🎬 Bidirectional Smart Cut Result:`);
    console.log(`  Video 1: End at ${video1TrimEnd.toFixed(4)}s (trim ${(video1Info.duration - video1TrimEnd).toFixed(4)}s)`);
    console.log(`  Video 2: Start at ${video2TrimStart.toFixed(4)}s`);
    console.log(`  Confidence: ${finalConfidence} (Score: ${best.combinedScore.toFixed(4)})`);

    return {
      video1TrimEnd,
      video2TrimStart,
      confidence: finalConfidence,
      score: best.combinedScore,
      details: {
        psnr: best.psnr,
        ssim: best.ssim,
        mse: best.mse
      }
    };

  } finally {
    try {
      fs.rmSync(framesDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

export async function POST(request: NextRequest) {
  const tempDir = "/tmp/smart-cut-" + uuidv4();

  try {
    const { video1Url, video2Url, searchDuration = 3 } = await request.json();

    if (!video1Url || !video2Url) {
      return NextResponse.json({ error: "Both video URLs are required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    fs.mkdirSync(tempDir, { recursive: true });

    // Download videos
    console.log('Downloading videos for Smart Cut analysis...');
    const video1Path = path.join(tempDir, 'video1.mp4');
    const video2Path = path.join(tempDir, 'video2.mp4');

    await downloadFile(video1Url, video1Path);
    await downloadFile(video2Url, video2Path);

    // Analyze bidirectionally
    const result = await analyzeSmartCutBidirectional(tempDir, video1Path, video2Path, searchDuration);

    return NextResponse.json({
      success: true,
      video1TrimEnd: result.video1TrimEnd,
      video2TrimStart: result.video2TrimStart,
      // Legacy support
      cutPoint: result.video2TrimStart,
      confidence: result.confidence,
      score: result.score,
      details: result.details
    });

  } catch (error: any) {
    console.error("Smart Cut analysis error:", error);
    return NextResponse.json(
      { error: error.message || "Analysis failed" },
      { status: 500 }
    );
  } finally {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {}
  }
}
