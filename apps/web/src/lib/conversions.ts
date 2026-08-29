export type Category = 
  | "Documents"
  | "Spreadsheets"
  | "Presentations"
  | "Images"
  | "Audio"
  | "Video"
  | "Archives"
  | "Ebooks"
  | "Fonts"
  | "CAD";

export interface ConversionMapping {
  from: string[];
  to: string[];
  engine: string;
  category: Category;
}

export const conversionRegistry: ConversionMapping[] = [
  {
    category: "Images",
    from: ["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp", "tiff", "heic", "avif"],
    to: ["jpg", "png", "webp", "gif", "tiff", "bmp", "avif"],
    engine: "sharp",
  },
  {
    category: "Documents",
    from: ["pdf", "docx", "doc", "odt", "rtf", "txt", "md", "html"],
    to: ["pdf", "docx", "odt", "txt", "html"],
    engine: "libreoffice",
  },
  {
    category: "Spreadsheets",
    from: ["xlsx", "xls", "ods", "csv", "tsv"],
    to: ["xlsx", "ods", "csv", "pdf"],
    engine: "libreoffice",
  },
  {
    category: "Presentations",
    from: ["pptx", "ppt", "odp"],
    to: ["pptx", "odp", "pdf"],
    engine: "libreoffice",
  },
  {
    category: "Audio",
    from: ["mp3", "wav", "flac", "aac", "ogg", "m4a"],
    to: ["mp3", "wav", "flac", "aac", "ogg"],
    engine: "ffmpeg",
  },
  {
    category: "Video",
    from: ["mp4", "mov", "avi", "mkv", "webm", "gif"],
    to: ["mp4", "mov", "avi", "webm", "gif", "mp3", "wav", "flac"],
    engine: "ffmpeg",
  },
  {
    category: "Archives",
    from: ["zip", "rar", "7z", "tar", "gz"],
    to: ["zip", "7z", "tar"],
    engine: "7-zip",
  },
  {
    category: "Ebooks",
    from: ["epub", "mobi", "azw3", "pdf"],
    to: ["epub", "mobi", "pdf"],
    engine: "calibre",
  }
];

export function getAvailableTargetFormats(fileName: string): string[] {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  for (const mapping of conversionRegistry) {
    if (mapping.from.includes(ext)) {
      // Exclude the original extension from the target list
      return mapping.to.filter(t => t !== ext);
    }
  }
  return []; // Unsupported
}

export function detectCategory(fileName: string): Category | "Unknown" {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  for (const mapping of conversionRegistry) {
    if (mapping.from.includes(ext)) {
      return mapping.category;
    }
  }
  return "Unknown";
}
