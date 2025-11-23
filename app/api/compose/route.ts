import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";

import { v4 as uuidv4 } from "uuid";

const COMPOSE_COST = 1; // Credits to deduct per composition
const GENERATE_COST = 2; // Credits for AI image generation

// Helper to strip the data:image/xxx;base64, prefix
const cleanBase64 = (dataUrl: string) => {
  return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
};

// Helper to upload image to Supabase Storage and save asset record
async function saveImageAsset(
  supabase: any,
  userId: string,
  base64Data: string,
  prompt: string,
  style?: string
): Promise<string | null> {
  try {
    const base64 = cleanBase64(base64Data);
    const buffer = Buffer.from(base64, 'base64');
    const fileName = `generated/${userId}/${uuidv4()}.png`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(fileName, buffer, { contentType: 'image/png', upsert: true });

    if (uploadError) {
      console.error("Failed to upload image:", uploadError);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    // Save asset record
    const { error: assetError } = await supabase
      .from('assets')
      .insert({
        user_id: userId,
        type: 'image',
        url: imageUrl,
        thumbnail_url: imageUrl,
        prompt: prompt,
        style: style,
        model: 'gemini-2.5-flash-image',
        metadata: { original_filename: fileName }
      });

    if (assetError) {
      console.error("Failed to save asset record:", assetError);
    }

    return imageUrl;
  } catch (e) {
    console.error("Error saving image asset:", e);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { avatarImage, productImage, canvasImage, prompt, referenceImages } = await request.json();

    // Check authentication
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

    if (profileError || !profile || profile.credits < COMPOSE_COST) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 403 });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Handle three different use cases:
    // 1. Initial compose: avatarImage + productImage -> composedImage (composition data)
    // 2. AI generation with 2 images: avatarImage + productImage + prompt -> generatedImage
    // 3. AI generation with canvas: canvasImage + prompt -> generatedImage (legacy)

    if (avatarImage && productImage && prompt) {
      // Use case 2: Generate AI image from 2 separate images using Gemini
      // Check credits for generation (costs more)
      if (profile.credits < GENERATE_COST) {
        return NextResponse.json({ error: "Insufficient credits for image generation" }, { status: 403 });
      }

      // First, use GPT-4 Vision to analyze both images
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      let productAnalysis = "";

      if (OPENAI_API_KEY) {
        try {
          const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

          console.log("Analyzing images with GPT-4 Vision...");
          const visionResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: { url: avatarImage },
                  },
                  {
                    type: "image_url",
                    image_url: { url: productImage },
                  },
                  {
                    type: "text",
                    text: `Analyze these two images:
Image 1: Person/Avatar image
Image 2: Product image

Describe:
1. The person (appearance, pose, what they're doing, clothing)
2. The product (type, brand if visible, colors, packaging, size)
3. How should the person naturally hold or interact with this product?
4. Best placement for the product (in hand, near face, on table, etc.)

Be very specific about both the person and product details.`,
                  },
                ],
              },
            ],
            max_tokens: 700,
          });

          productAnalysis = visionResponse.choices[0]?.message?.content || "";
          console.log("Image analysis:", productAnalysis);
        } catch (e) {
          console.error("GPT-4 Vision analysis failed:", e);
        }
      }

      const hasRefs = referenceImages && referenceImages.length > 0;
      const imagePrompt = `CREATE A NEW ADVERTISEMENT PHOTO:

SOURCE IMAGES:
- Image 1 (PERSON SOURCE): This is the person/model to use. Keep their EXACT face, skin tone, hair, and body.
- Image 2 (PRODUCT SOURCE): This is the product to feature. Keep its EXACT design, colors, logo, and packaging.

${hasRefs ? `OUTPUT REFERENCE (Image 3${referenceImages.length > 1 ? ` onwards` : ''}): These images show EXAMPLES of the desired OUTPUT style. The generated image should look similar to these references in terms of:
- How the person poses with the product
- The camera angle and framing
- The lighting style and mood
- The background and environment
- The overall composition and aesthetic
CREATE the output to match these reference examples, but using the person from Image 1 and the product from Image 2.` : ''}

${productAnalysis ? `ANALYSIS:\n${productAnalysis}\n` : ""}

STYLE/TASK: ${prompt}

GENERATE AN IMAGE THAT:
1. Uses the EXACT person from Image 1 (same face, same appearance)
2. Features the EXACT product from Image 2 (identical design, colors, logo)
3. ${hasRefs ? 'Matches the style, composition, pose, and mood shown in the output reference images' : 'Shows the person naturally using/holding/wearing the product'}
4. Looks like a real professional advertisement photo
5. Has cohesive lighting and realistic integration

${hasRefs ? 'The output should look like the reference images, but starring the person from Image 1 with the product from Image 2.' : 'Output a single professional advertisement photo.'}`;

      console.log("Generating image with Gemini from 2 images, prompt:", imagePrompt);

      try {
        // Build parts array with avatar, product, and optional reference images
        const parts: any[] = [
          {
            inlineData: {
              mimeType: "image/png",
              data: cleanBase64(avatarImage),
            },
          },
          {
            inlineData: {
              mimeType: "image/png",
              data: cleanBase64(productImage),
            },
          },
        ];

        // Add reference images if provided
        if (referenceImages && referenceImages.length > 0) {
          for (const refImg of referenceImages) {
            parts.push({
              inlineData: {
                mimeType: "image/png",
                data: cleanBase64(refImg),
              },
            });
          }
        }

        // Add the prompt at the end
        parts.push({ text: imagePrompt });

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: { parts },
        });

        // Extract image from response
        let generatedImageData: string | null = null;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if ((part as any).inlineData) {
            const inlineData = (part as any).inlineData;
            generatedImageData = `data:${inlineData.mimeType};base64,${inlineData.data}`;
            break;
          }
        }

        if (!generatedImageData) {
          console.error("No image in Gemini response, parts:", JSON.stringify(response.candidates?.[0]?.content?.parts, null, 2));
          throw new Error("No image generated by Gemini");
        }

        // Deduct credits
        await supabase
          .from('profiles')
          .update({ credits: profile.credits - GENERATE_COST })
          .eq('id', user.id);

        // Save image to storage and assets table (async, don't wait)
        saveImageAsset(supabase, user.id, generatedImageData, prompt, prompt.substring(0, 100));

        return NextResponse.json({
          generatedImage: generatedImageData,
        });
      } catch (geminiError: any) {
        console.error("Gemini image generation error:", geminiError);

        return NextResponse.json({
          error: geminiError.message || "Image generation failed",
        }, { status: 500 });
      }

    } else if (canvasImage && prompt) {
      // Use case 3 (legacy): Generate AI-enhanced image from single canvas
      // Check credits for generation (costs more)
      if (profile.credits < GENERATE_COST) {
        return NextResponse.json({ error: "Insufficient credits for image generation" }, { status: 403 });
      }

      const imagePrompt = `Edit this image to create a professional advertisement photo.

Style to apply: ${prompt}

Requirements:
- Keep the product EXACTLY as it appears
- Apply the requested style to lighting, background, and mood
- Create a cohesive, professional advertisement look`;

      console.log("Generating image with Gemini from canvas, prompt:", imagePrompt);

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: cleanBase64(canvasImage),
                },
              },
              {
                text: imagePrompt,
              },
            ],
          },
        });

        // Extract image from response
        let generatedImageData: string | null = null;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if ((part as any).inlineData) {
            const inlineData = (part as any).inlineData;
            generatedImageData = `data:${inlineData.mimeType};base64,${inlineData.data}`;
            break;
          }
        }

        if (!generatedImageData) {
          console.error("No image in Gemini response, parts:", JSON.stringify(response.candidates?.[0]?.content?.parts, null, 2));
          throw new Error("No image generated by Gemini");
        }

        // Deduct credits
        await supabase
          .from('profiles')
          .update({ credits: profile.credits - GENERATE_COST })
          .eq('id', user.id);

        // Save image to storage and assets table (async, don't wait)
        saveImageAsset(supabase, user.id, generatedImageData, prompt, prompt.substring(0, 100));

        return NextResponse.json({
          generatedImage: generatedImageData,
        });
      } catch (geminiError: any) {
        console.error("Gemini image generation error:", geminiError);

        return NextResponse.json({
          generatedImage: canvasImage,
          error: geminiError.message || "Image generation failed, showing original",
        });
      }

    } else if (avatarImage && productImage) {
      // Use case 1: Compose avatar and product images - suggest placement
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: cleanBase64(avatarImage),
              },
            },
            {
              inlineData: {
                mimeType: "image/png",
                data: cleanBase64(productImage),
              },
            },
            {
              text: `I have a background image (first image) and an item (second image). Identify the best logical place to put the item on the background (e.g., if the background is a person, put the item in their hand; if it's a hat, on their head).

The background image dimensions are approximately 800x1000 pixels.

Return a JSON object with:
- 'productScale': scale multiplier (0.1 to 2.0)
- 'productX': horizontal position in pixels (0 = left edge, 400 = center, 800 = right edge)
- 'productY': vertical position in pixels (0 = top, 500 = center, 1000 = bottom)
- 'productRotation': rotation in degrees (-45 to 45)
- 'explanation': brief explanation of placement

Example: {"productScale": 0.3, "productX": 400, "productY": 500, "productRotation": 0, "explanation": "Placed in hand"}

Return ONLY valid JSON, no other text.`,
            },
          ],
        },
      });

      let compositionText = response.text || "";

      // Clean up the response - remove markdown code blocks if present
      compositionText = compositionText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let composition;
      try {
        composition = JSON.parse(compositionText);
      } catch (e) {
        // Fallback to default positioning if AI response parsing fails
        console.error("Failed to parse AI response:", compositionText);
        composition = {
          productScale: 0.3,
          productX: 400,
          productY: 500,
          productRotation: 0,
          explanation: "Default centered positioning"
        };
      }

      // Deduct credits
      await supabase
        .from('profiles')
        .update({ credits: profile.credits - COMPOSE_COST })
        .eq('id', user.id);

      // Return composition data that includes the original images and AI suggestions
      return NextResponse.json({
        composedImage: JSON.stringify({
          avatar: avatarImage,
          product: productImage,
          composition: composition,
        }),
      });

    } else {
      return NextResponse.json(
        { error: "Missing required images. Provide either (avatarImage + productImage) or (canvasImage + prompt)" },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error("Error in compose API:", error);
    return NextResponse.json(
      { error: error.message || "Failed to compose images" },
      { status: 500 }
    );
  }
}
