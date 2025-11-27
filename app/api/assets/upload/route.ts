import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as 'image' | 'video';

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!type || (type !== 'image' && type !== 'video')) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

    if (type === 'image' && !validImageTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid image format. Supported: JPG, PNG, GIF, WebP" }, { status: 400 });
    }

    if (type === 'video' && !validVideoTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid video format. Supported: MP4, WebM, MOV" }, { status: 400 });
    }

    // File size limit: 100MB for videos, 10MB for images
    const maxSize = type === 'video' ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({
        error: `File too large. Max size: ${type === 'video' ? '100MB' : '10MB'}`
      }, { status: 400 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `uploaded/${user.id}/${uuidv4()}.${fileExt}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);

    // Create asset record
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .insert({
        user_id: user.id,
        type: type,
        url: urlData.publicUrl,
        thumbnail_url: urlData.publicUrl,
        prompt: `Uploaded ${type}: ${file.name}`,
        model: 'user-upload',
        metadata: {
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type
        }
      })
      .select()
      .single();

    if (assetError) {
      console.error('Asset creation error:', assetError);
      // Try to clean up uploaded file
      await supabase.storage.from('images').remove([fileName]);
      return NextResponse.json({ error: "Failed to create asset record" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      asset: asset
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}
