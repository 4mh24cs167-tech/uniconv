import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();

    let outputBuffer: Buffer;

    if (file.type.startsWith("image/")) {
      // MVP: We apply a blur to simulate a watermark removal/inpainting operation
      outputBuffer = await sharp(Buffer.from(buffer))
        .median(3) // Simple blur effect to simulate ML watermark removal
        .toBuffer();
    } else {
      // MVP for video: return the file after a delay to simulate processing
      await new Promise(r => setTimeout(r, 2000));
      outputBuffer = Buffer.from(buffer);
    }

    return new NextResponse(outputBuffer, {
      headers: {
        "Content-Type": file.type,
        "Content-Disposition": `attachment; filename="cleaned_${file.name}"`,
      },
    });

  } catch (error) {
    console.error("Watermark removal error:", error);
    return NextResponse.json({ error: "Internal server error during watermark removal" }, { status: 500 });
  }
}
