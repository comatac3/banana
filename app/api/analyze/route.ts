import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { avatarImage, productImage } = await request.json();

    if (!avatarImage || !productImage) {
      return NextResponse.json({ error: "Both images are required" }, { status: 400 });
    }

    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      // Return default analysis if no OpenAI key
      return NextResponse.json({
        avatar: {
          description: "Person in the image",
          gender: "unknown",
          age: "adult",
          pose: "standing",
          clothing: "casual wear",
        },
        product: {
          name: "Product",
          type: "item",
          brand: "",
          color: "various",
          size: "medium",
          description: "Product to be featured",
        },
        suggestion: {
          placement: "hand",
          interaction: "holding naturally",
          style: "professional advertisement",
        },
      });
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // Analyze both images with GPT-4 Vision
    const response = await openai.chat.completions.create({
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
              text: `Analyze these two images and return a JSON object with the following structure:

{
  "avatar": {
    "description": "Brief description of the person",
    "gender": "male/female/unknown",
    "age": "child/teen/adult/senior",
    "pose": "current pose description",
    "clothing": "what they're wearing",
    "expression": "facial expression"
  },
  "product": {
    "name": "specific product name if visible, or generic name",
    "type": "category (cosmetics, food, electronics, clothing, beverage, etc.)",
    "brand": "brand name if visible, empty string if not",
    "color": "main colors",
    "size": "small/medium/large/varies",
    "description": "detailed description of the product",
    "features": ["key feature 1", "key feature 2"]
  },
  "suggestion": {
    "placement": "where to place product (hand, near face, on table, worn, etc.)",
    "interaction": "how person should interact with product",
    "style": "recommended ad style (luxury, casual, sporty, elegant, fun, etc.)",
    "background": "suggested background setting"
  }
}

Be specific about the product. If it's a lipstick, say "lipstick". If it's a phone, identify the model if possible.
Return ONLY valid JSON, no other text.`,
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    let analysisText = response.choices[0]?.message?.content || "";

    // Check for refusal patterns
    const refusalPatterns = [
      "I'm sorry, I can't",
      "I cannot assist",
      "I can't assist",
      "I'm unable to",
      "I cannot help",
      "I can't help",
      "not able to assist",
      "unable to process",
      "cannot process this",
      "inappropriate content",
      "violates our",
      "against our policies",
    ];

    const isRefusal = refusalPatterns.some(pattern =>
      analysisText.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isRefusal) {
      console.error("AI refused to analyze images:", analysisText);
      return NextResponse.json(
        {
          error: "content_refused",
          message: "The AI could not analyze these images. Please try different images that clearly show a person and a product."
        },
        { status: 422 }
      );
    }

    // Clean up the response
    analysisText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (e) {
      console.error("Failed to parse AI analysis:", analysisText);
      // Return default if parsing fails
      analysis = {
        avatar: {
          description: "Person in the image",
          gender: "unknown",
          age: "adult",
          pose: "standing",
          clothing: "casual wear",
        },
        product: {
          name: "Product",
          type: "item",
          brand: "",
          color: "various",
          size: "medium",
          description: "Product to be featured",
        },
        suggestion: {
          placement: "hand",
          interaction: "holding naturally",
          style: "professional advertisement",
        },
      };
    }

    return NextResponse.json(analysis);

  } catch (error: any) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze images" },
      { status: 500 }
    );
  }
}
