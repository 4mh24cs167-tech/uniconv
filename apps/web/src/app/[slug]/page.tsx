import { MainWorkspace } from "@/components/MainWorkspace";
import { Metadata } from "next";
import { notFound } from "next/navigation";

// Define the available tools for SEO
const toolMappings: Record<string, { title: string, description: string, keywords: string[] }> = {
  "audio-converter": { 
    title: "Audio Converter | UniConv", 
    description: "Free online audio converter. Convert MP3, WAV, OGG, and AAC files instantly.",
    keywords: ["audio converter", "mp3 to wav", "convert audio"]
  },
  "secure-pdf": { 
    title: "Secure PDF | Add Password & Permissions", 
    description: "Protect your PDF files with 256-bit AES encryption. Add passwords, restrict editing, and add watermarks.",
    keywords: ["secure pdf", "encrypt pdf", "pdf password", "pdf permissions"]
  },
  "merge-pdf": { 
    title: "Merge PDF | Combine PDF Files Online", 
    description: "Combine multiple PDF files into one easily. The best free online PDF merger.",
    keywords: ["merge pdf", "combine pdf", "join pdf"]
  },
  "split-pdf": { 
    title: "Split PDF | Extract Pages Online", 
    description: "Extract pages from your PDF or split a large PDF into smaller files.",
    keywords: ["split pdf", "extract pdf pages", "cut pdf"]
  },
  "compress-pdf": { 
    title: "Compress PDF | Reduce File Size", 
    description: "Compress your PDF files without losing quality. Make PDFs smaller for emailing.",
    keywords: ["compress pdf", "reduce pdf size", "shrink pdf"]
  },
  "pdf-to-word": { 
    title: "PDF to Word Converter | UniConv", 
    description: "Convert PDF to editable DOCX Word documents instantly for free.",
    keywords: ["pdf to word", "pdf to docx", "convert pdf to word"]
  },
  "pdf-to-powerpoint": { 
    title: "PDF to PowerPoint | UniConv", 
    description: "Convert PDF to editable PPTX PowerPoint presentations instantly.",
    keywords: ["pdf to ppt", "pdf to powerpoint", "convert pdf to ppt"]
  },
  "pdf-to-excel": { 
    title: "PDF to Excel Converter | UniConv", 
    description: "Intelligently extract tables and data from PDF documents directly into Excel spreadsheets.",
    keywords: ["pdf to excel", "pdf to xlsx", "extract tables from pdf"]
  },
  "word-to-pdf": { 
    title: "Word to PDF Converter | UniConv", 
    description: "Convert DOCX and DOC files to PDF securely and accurately.",
    keywords: ["word to pdf", "docx to pdf", "convert word to pdf"]
  },
  "powerpoint-to-pdf": { 
    title: "PowerPoint to PDF | UniConv", 
    description: "Convert PPT and PPTX files to PDF instantly for easy sharing.",
    keywords: ["ppt to pdf", "powerpoint to pdf", "convert ppt to pdf"]
  },
  "excel-to-pdf": { 
    title: "Excel to PDF | UniConv", 
    description: "Convert XLSX and XLS spreadsheets to PDF documents.",
    keywords: ["excel to pdf", "xlsx to pdf", "convert excel to pdf"]
  },
  "jpg-to-pdf": { 
    title: "JPG to PDF Converter | UniConv", 
    description: "Convert JPG, PNG, and WEBP images into a single PDF document.",
    keywords: ["jpg to pdf", "png to pdf", "image to pdf"]
  },
  "pdf-to-jpg": { 
    title: "PDF to JPG | Extract Images", 
    description: "Convert every page of a PDF into high-quality JPG images.",
    keywords: ["pdf to jpg", "convert pdf to image", "pdf pages to jpg"]
  },
  "compress-jpg": { 
    title: "Compress JPG | Image Optimizer", 
    description: "Compress JPG, PNG, and WEBP images to reduce file size while maintaining quality.",
    keywords: ["compress jpg", "image compressor", "reduce image size"]
  },
  "extract-text-ocr": { 
    title: "Extract Text from Image (OCR) | UniConv", 
    description: "Scan images or PDFs and use A.I. to extract editable text files instantly.",
    keywords: ["ocr online", "extract text from image", "image to text"]
  },
  "watermark-remover": { 
    title: "Watermark Remover | A.I. Video & Image Editor", 
    description: "Automatically detect and remove watermarks from images and videos using AI.",
    keywords: ["remove watermark", "video watermark remover", "image watermark remover"]
  },
  "extract-audio": { 
    title: "Extract Audio from Video | UniConv", 
    description: "Extract high-quality audio (MP3, WAV) from any video file instantly.",
    keywords: ["video to mp3", "extract audio", "mp4 to mp3"]
  },
  "html-to-pdf": { 
    title: "HTML to PDF | Webpage Converter", 
    description: "Convert HTML webpages into high-quality PDF documents.",
    keywords: ["html to pdf", "web to pdf", "save page as pdf"]
  },
  "unlock-pdf": { 
    title: "Unlock PDF | Remove PDF Password", 
    description: "Remove passwords and security restrictions from your PDF files.",
    keywords: ["unlock pdf", "remove pdf password", "decrypt pdf"]
  }
};

type Props = {
  params: Promise<{ slug: string }>
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const tool = toolMappings[resolvedParams.slug];
  
  if (!tool) {
    return {
      title: "Tool Not Found | UniConv"
    };
  }

  return {
    title: tool.title,
    description: tool.description,
    keywords: tool.keywords,
    openGraph: {
      title: tool.title,
      description: tool.description,
      url: `https://uniconv-psi.vercel.app/${resolvedParams.slug}`,
      siteName: "UniConv",
      type: "website",
    }
  };
}

export default async function ToolPage({ params }: Props) {
  const resolvedParams = await params;
  if (!toolMappings[resolvedParams.slug]) {
    notFound();
  }

  return <MainWorkspace initialSlug={resolvedParams.slug} />;
}
