import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const format = formData.get("format") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!format) {
      return NextResponse.json({ error: "No target format provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();

    // In a real app with large files, we'd use streams. 
    // For Phase 1 (images < 20MB), memory buffers are fine.
    let outputBuffer: Buffer;
    let contentType = `application/octet-stream`;
    
    if (file.type.startsWith("image/") && ["png", "jpg", "jpeg", "webp"].includes(format)) {
      const sharpInstance = sharp(Buffer.from(buffer));
      
      switch (format) {
        case "png":
          outputBuffer = await sharpInstance.png().toBuffer();
          contentType = "image/png";
          break;
        case "jpg":
        case "jpeg":
          outputBuffer = await sharpInstance.jpeg().toBuffer();
          contentType = "image/jpeg";
          break;
        case "webp":
          outputBuffer = await sharpInstance.webp().toBuffer();
          contentType = "image/webp";
          break;
        default:
          outputBuffer = await sharpInstance.png().toBuffer();
          contentType = "image/png";
      }
    } else {
      // Mock processing for non-image or complex conversions (PDF, Video, Excel, etc.)
      await new Promise(r => setTimeout(r, 2000));
      
      if (format === "pdf") {
        // Minimal valid PDF string
        const minimalPdf = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <</Font <</F1 4 0 R>> >> /Contents 5 0 R>> endobj
4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
5 0 obj <</Length 60>> stream
BT /F1 24 Tf 100 700 Td (Simulated PDF Conversion!) Tj ET
endstream endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000212 00000 n 
0000000279 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
390
%%EOF`;
        outputBuffer = Buffer.from(minimalPdf);
        contentType = "application/pdf";
      } else if (format === "xlsx" || format === "csv") {
        // Minimal valid CSV simulating Excel data extraction
        outputBuffer = Buffer.from("Name,Email,Status\nJohn Doe,john@test.com,Extracted");
        contentType = "text/csv";
      } else {
        // Fallback for audio, video, archives
        outputBuffer = Buffer.from("Mocked conversion output for format: " + format);
        if (format === "mp3") contentType = "audio/mpeg";
        if (format === "mp4") contentType = "video/mp4";
      }
    }

    return new NextResponse(outputBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="converted.${format}"`,
      },
    });

  } catch (error) {
    console.error("Conversion error:", error);
    return NextResponse.json({ error: "Internal server error during conversion" }, { status: 500 });
  }
}
