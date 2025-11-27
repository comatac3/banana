import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { assetId, taskId, canExtend } = await request.json();

    if (!assetId) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the asset first to verify ownership
    const { data: asset, error: fetchError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Build updated metadata
    const currentMetadata = asset.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      ...(taskId !== undefined && { taskId }),
      ...(canExtend !== undefined && { canExtend }),
    };

    // Update the asset
    const { error: updateError } = await supabase
      .from('assets')
      .update({ metadata: updatedMetadata })
      .eq('id', assetId)
      .eq('user_id', user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      metadata: updatedMetadata,
    });

  } catch (error: any) {
    console.error("Error updating asset metadata:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update asset" },
      { status: 500 }
    );
  }
}
