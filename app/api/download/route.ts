import { NextRequest, NextResponse } from "next/server";

// Store image data temporarily for download
const imageStore = new Map<string, { data: string; filename: string; timestamp: number }>();

// Clean up old entries (older than 5 minutes)
const cleanupStore = () => {
  const now = Date.now();
  for (const [key, value] of imageStore.entries()) {
    if (now - value.timestamp > 5 * 60 * 1000) {
      imageStore.delete(key);
    }
  }
};

// POST: Store image and return download ID with filename
export async function POST(request: NextRequest) {
  try {
    cleanupStore();
    const { imageData } = await request.json();

    if (!imageData) {
      return NextResponse.json({ error: "No image data provided" }, { status: 400 });
    }

    // Extract extension from MIME type
    const mimeMatch = imageData.match(/^data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const extension = mimeType.split('/')[1] || 'png';
    const filename = `banana-composed-${Date.now()}.${extension}`;

    // Generate unique ID
    const downloadId = Math.random().toString(36).substring(2, 15);
    imageStore.set(downloadId, { data: imageData, filename, timestamp: Date.now() });

    return NextResponse.json({ downloadId, filename });
  } catch (error) {
    console.error("Store error:", error);
    return NextResponse.json({ error: "Failed to prepare download" }, { status: 500 });
  }
}

// GET: Download the image by ID
export async function GET(request: NextRequest) {
  try {
    const downloadId = request.nextUrl.searchParams.get('id');

    if (!downloadId) {
      return NextResponse.json({ error: "No download ID provided" }, { status: 400 });
    }

    const stored = imageStore.get(downloadId);
    if (!stored) {
      return NextResponse.json({ error: "Download expired or not found" }, { status: 404 });
    }

    // Remove from store after retrieval
    imageStore.delete(downloadId);

    const imageData = stored.data;
    const filename = stored.filename;

    // Extract MIME type and base64 data from data URL
    const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json({ error: "Invalid image data format" }, { status: 400 });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    // Convert base64 to binary
    const binaryData = Buffer.from(base64Data, 'base64');

    // Return as downloadable file with explicit filename
    return new NextResponse(binaryData, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': binaryData.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
