"use client";

import { useState, useEffect, useRef } from "react";
import { UploadZone } from "@/components/UploadZone";
import { FormatPicker } from "@/components/FormatPicker";
import { ToolCard } from "@/components/ToolCard";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Download, Eraser, ArrowLeft, FileText, FileImage, FileSpreadsheet, FileArchive, Zap, Settings, Lock, Menu, X, UploadCloud, Music, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { PremiumGate } from "@/components/PremiumGate";

type ViewState = "HUB" | "UNIVERSAL_CONVERTER" | "WATERMARK_REMOVER" | "PDF_TO_EXCEL" | "AUDIO_CONVERTER" | "SECURE_PDF";

const AdsterraBanner = () => {
  const banner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!banner.current) return;
    
    // Clear any existing ad to prevent duplicates on re-renders
    banner.current.innerHTML = '';

    const conf = document.createElement('script');
    conf.type = 'text/javascript';
    conf.innerHTML = `atOptions = {
      'key' : 'ac26a747103aa507dba80d5383d1b753',
      'format' : 'iframe',
      'height' : 600,
      'width' : 160,
      'params' : {}
    };`;

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://www.highrevenueformat.com/ac26a747103aa507dba80d5383d1b753/invoke.js';
    
    banner.current.append(conf);
    banner.current.append(script);
  }, []);

  return <div ref={banner} className="w-[160px] h-[600px] flex items-center justify-center text-xs text-slate-400 bg-transparent" />;
};

export default function Home() {
  const [isPremium, setIsPremium] = useState(false);
  const [userPlan, setUserPlan] = useState("free");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState<ViewState>("HUB");
  const [activeToolTitle, setActiveToolTitle] = useState<string>("");
  const [splitPage, setSplitPage] = useState<number>(1);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  
  // Audio Conversions state
  const [sourceAudioFormat, setSourceAudioFormat] = useState<string>("mp3");
  const [targetAudioFormat, setTargetAudioFormat] = useState<string>("wav");

  // Secure PDF state
  const [secureTool, setSecureTool] = useState<string>("password");
  const [secureConfig, setSecureConfig] = useState<any>({});

  // Watermark Remover state
  const [watermarkPos, setWatermarkPos] = useState<string>("bottom_right");

  // Ad state
  const [ad, setAd] = useState<{image_url: string, target_url: string} | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchPlanAndAd = async () => {
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      // Fetch Ad
      try {
        const { data } = await supabase.from('ads').select('*').eq('is_active', true).limit(1).single();
        if (data) {
          setAd(data);
        }
      } catch (e) {
        // Fallback or ignore if table doesn't exist yet
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsLoggedIn(true);
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "4mh24cs167@gmail.com";
        if (session.user.email === adminEmail) {
          setIsPremium(true);
          setUserPlan("premium");
        } else {
          const { data } = await supabase.from("users").select("plan:plans(name)").eq("id", session.user.id).single();
          const planData = data?.plan as any;
          if (planData?.name) {
            const pName = String(planData.name).toLowerCase();
            if (pName === "pro" || pName === "premium") {
              setIsPremium(true);
            }
            setUserPlan(pName);
          }
        }
      }
    };
    fetchPlanAndAd();
  }, []);

  // Shared state for the active tool
  const [files, setFiles] = useState<File[]>([]);
  const [targetFormat, setTargetFormat] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPremiumGate, setShowPremiumGate] = useState(false);
  const [rejectedFileSize, setRejectedFileSize] = useState(0);

  const [availableFormats, setAvailableFormats] = useState<string[]>([]);
  const [detectedCategory, setDetectedCategory] = useState<string>("Unknown");

  const resetState = () => {
    setFiles([]);
    setTargetFormat("");
    setIsProcessing(false);
    setProgress(0);
    setResultUrl(null);
    setResultFilename(null);
    setError(null);
    setAvailableFormats([]);
    setDetectedCategory("Unknown");
  };

  const navigateTo = (v: ViewState, title: string = "") => {
    resetState();
    setActiveToolTitle(title);
    setView(v);
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setProgress(10);
    setError(null);
    setResultUrl(null);

    const isWatermark = activeToolTitle === "Watermark Remover";
    const isExcelTemplate = view === "PDF_TO_EXCEL";
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://uniconv.onrender.com";

    try {
      // 1. Upload files to Supabase Storage
      const { uploadFileToSupabaseResumable } = await import('@/lib/upload');
      
      const fileIds: string[] = [];
      let totalUploaded = 0;
      
      for (const f of files) {
        const fileRecordOrString = await uploadFileToSupabaseResumable(f, "uploads", (p) => {
          // Math to split the 50% progress among all files
          const baseProgress = (totalUploaded / files.length) * 50;
          const currentFileProgress = (p / 100) * (50 / files.length);
          setProgress(Math.floor(baseProgress + currentFileProgress));
        });

        if (!fileRecordOrString) {
          throw new Error(`Failed to upload ${f.name}`);
        }
        
        // uploadFileToSupabaseResumable returns string (the filename/path)
        // Wait, we need to create the file in DB to get an ID.
        // The mock uploadFileToSupabaseResumable returns a string filename.
        // So we need to insert it into DB if it doesn't return an object.
        const { createBrowserClient } = await import('@supabase/ssr');
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        const fileName = typeof fileRecordOrString === 'string' ? fileRecordOrString : (fileRecordOrString as any).id;
        
        // Get user if any
        const { data: { session } } = await supabase.auth.getSession();
        
        const fileRes = await supabase.from("files").insert({
            user_id: session?.user?.id || null,
            filename: f.name,
            original_filename: f.name,
            size_bytes: f.size,
            storage_key: fileName
        }).select().single();
        
        if (fileRes.data) {
          fileIds.push(fileRes.data.id);
        }
        
        totalUploaded++;
      }

      let toolName = activeToolTitle;
      let finalTargetFormat = targetFormat;
      let configuration: any = undefined;

      if (view === "AUDIO_CONVERTER") {
        toolName = "Audio Conversions";
        finalTargetFormat = targetAudioFormat;
        configuration = { target_format: targetAudioFormat };
      } else if (view === "SECURE_PDF") {
        toolName = `secure_pdf_${secureTool}`;
        configuration = secureConfig;
      } else if (activeToolTitle === "Split PDF") {
        configuration = { split_page: splitPage };
      } else if (view === "WATERMARK_REMOVER") {
        configuration = { position: watermarkPos };
      }

      // 2. Create Job in FastAPI Backend
      const res = await fetch(`${apiUrl}/api/jobs?file_id=${fileIds[0]}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: toolName,
          target_format: finalTargetFormat || null,
          input_file_ids: fileIds,
          configuration: configuration
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to start job");
      }

      const jobData = await res.json();
      const jobId = jobData.job_id;

      // 3. Poll for Job Status
      let simProgress = 50;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      
      pollIntervalRef.current = setInterval(async () => {
        // Increase progress bar smoothly up to 90%
        if (simProgress < 90) {
          simProgress += 10;
          setProgress(simProgress);
        }

        try {
          // Fetch job status from Supabase
          const { createBrowserClient } = await import('@supabase/ssr');
          const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          );
          
          const { data, error } = await supabase.from("processing_jobs").select("*, result_file:files(*)").eq("id", jobId).single();
          
          if (error) {
            console.error("Supabase polling error:", error);
            // Don't kill polling immediately on transient errors, just log it.
          }

          if (data) {
            if (data.status === "COMPLETED") {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              setProgress(100);
              
              if (data.result_file && data.result_file.storage_key) {
                const { data: urlData } = supabase.storage.from("results").getPublicUrl(data.result_file.storage_key, { download: true });
                setResultUrl(urlData.publicUrl);
                setResultFilename(data.result_file.storage_key);
              } else if (data.result_file && Array.isArray(data.result_file) && data.result_file[0]?.storage_key) {
                // In case it returns an array
                const { data: urlData } = supabase.storage.from("results").getPublicUrl(data.result_file[0].storage_key, { download: true });
                setResultUrl(urlData.publicUrl);
                setResultFilename(data.result_file[0].storage_key);
              }
              setIsProcessing(false);
            } else if (data.status === "FAILED") {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              setError(data.error_message || "Processing failed");
              setIsProcessing(false);
            }
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 3000);

    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
      setIsProcessing(false);
    }
  };

  return (
    <div className={clsx(
      "min-h-screen transition-colors duration-500 font-sans",
      isPremium ? "dark bg-slate-950 text-slate-50" : "bg-slate-50 text-slate-900"
    )}>
      {/* Ad Banners */}
      <div className="hidden 2xl:block fixed left-4 top-1/2 -translate-y-1/2 w-[160px] h-[600px] z-50">
        <AdsterraBanner />
      </div>
      <div className="hidden 2xl:block fixed right-4 top-1/2 -translate-y-1/2 w-[160px] h-[600px] z-50">
        <AdsterraBanner />
      </div>

      {/* Header */}
      <header className={clsx(
        "sticky top-0 z-50 border-b backdrop-blur-md transition-colors",
        isPremium ? "bg-slate-900/80 border-white/10" : "bg-white/80 border-slate-200"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigateTo("HUB", "")}>
            <div className="p-2 bg-[#e5322d] text-white rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
            <span className={clsx(
              "text-xl font-extrabold tracking-tight",
              isPremium ? "text-white" : "text-slate-800"
            )}>
              uniconv
            </span>
            {isPremium && (
              <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full">
                PRO
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <a href="/pricing" className={clsx(
              "text-sm font-semibold transition-colors mr-2",
              isPremium ? "text-purple-300 hover:text-white" : "text-purple-600 hover:text-purple-900"
            )}>
              Pricing
            </a>
            <a href={isLoggedIn ? "/dashboard" : "/login"} className={clsx(
              "text-sm font-semibold transition-colors",
              isPremium ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
            )}>
              {isLoggedIn ? "Dashboard" : "Log in"}
            </a>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="max-w-[1400px] mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {view === "HUB" && (
            <motion.div 
              key="hub"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="text-center max-w-3xl mx-auto mt-8 mb-16 space-y-6">
                <h2 className={clsx(
                  "text-4xl sm:text-6xl font-black tracking-tight leading-tight",
                  isPremium ? "text-white" : "text-slate-900"
                )}>
                  Every tool you need, <br/>
                  <span className={isPremium ? "text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400" : "text-blue-600"}>
                    in one place.
                  </span>
                </h2>
                <p className={clsx(
                  "text-xl font-medium",
                  isPremium ? "text-slate-400" : "text-slate-600"
                )}>
                  Convert, extract, and clean your files with a few clicks. Secure, fast, and fully automated.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                <ToolCard 
                  isPremium={isPremium}
                  title="Audio Conversions" 
                  description="Convert your audio files between popular formats."
                  icon={<Music className="w-10 h-10" />}
                  onClick={() => { navigateTo("AUDIO_CONVERTER", "Audio Conversions"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="Secure PDF" 
                  description="Protect and secure your PDF documents with passwords, permissions, watermarks and redaction."
                  icon={<Shield className="w-10 h-10" />}
                  onClick={() => { navigateTo("SECURE_PDF", "Secure PDF"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="Merge PDF" 
                  description="Combine PDFs in the order you want with the easiest PDF merger available."
                  icon={<FileText className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("pdf"); navigateTo("UNIVERSAL_CONVERTER", "Merge PDF"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="Split PDF" 
                  description="Separate one page or a whole set for easy conversion into independent PDF files."
                  icon={<FileText className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("pdf"); navigateTo("UNIVERSAL_CONVERTER", "Split PDF"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="Compress PDF" 
                  description="Reduce file size while optimizing for maximal PDF quality."
                  icon={<FileArchive className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("pdf"); navigateTo("UNIVERSAL_CONVERTER", "Compress PDF"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="PDF to Word" 
                  description="Easily convert your PDF files into easy to edit DOC and DOCX documents."
                  icon={<FileText className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("docx"); navigateTo("UNIVERSAL_CONVERTER", "PDF to Word"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="PDF to PowerPoint" 
                  description="Turn your PDF files into easy to edit PPT and PPTX slideshows."
                  icon={<FileText className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("pptx"); navigateTo("UNIVERSAL_CONVERTER", "PDF to PowerPoint"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="PDF to Excel" 
                  description="Extract data from PDF to Excel spreadsheets in a few seconds."
                  icon={<FileSpreadsheet className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("xlsx"); navigateTo("PDF_TO_EXCEL", "PDF to Excel"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="Word to PDF" 
                  description="Make DOC and DOCX files easy to read by converting them to PDF."
                  icon={<FileText className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("pdf"); navigateTo("UNIVERSAL_CONVERTER", "Word to PDF"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="PowerPoint to PDF" 
                  description="Make PPT and PPTX slideshows easy to view by converting them to PDF."
                  icon={<FileText className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("pdf"); navigateTo("UNIVERSAL_CONVERTER", "PowerPoint to PDF"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="Excel to PDF" 
                  description="Make EXCEL spreadsheets easy to read by converting them to PDF."
                  icon={<FileSpreadsheet className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("pdf"); navigateTo("UNIVERSAL_CONVERTER", "Excel to PDF"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="JPG to PDF" 
                  description="Convert JPG images to PDF in seconds. Easily adjust orientation and margins."
                  icon={<FileImage className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("pdf"); navigateTo("UNIVERSAL_CONVERTER", "JPG to PDF"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="PDF to JPG" 
                  description="Extract all images inside a PDF or convert each page to a JPG image."
                  icon={<FileImage className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("jpg"); navigateTo("UNIVERSAL_CONVERTER", "PDF to JPG"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="JPG Compressor" 
                  description="Compress your JPG images to the smallest file size while keeping perfect quality."
                  icon={<FileImage className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("jpg"); navigateTo("UNIVERSAL_CONVERTER", "Compress JPG"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="Extract Text (OCR)" 
                  description="Scan images or PDFs and use A.I. to extract editable text files instantly."
                  icon={<FileText className="w-10 h-10 text-purple-500" />}
                  onClick={() => { 
                    if (userPlan === "pro" || userPlan === "premium") {
                      setTargetFormat("txt"); navigateTo("UNIVERSAL_CONVERTER", "Extract Text (OCR)"); 
                    } else {
                      alert("Extract Text (OCR) is a Pro/Premium feature. Please upgrade your plan.");
                      window.location.href = "/pricing";
                    }
                  }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="Watermark Remover" 
                  description="Automatically detect and remove watermarks from images or videos."
                  icon={<Eraser className="w-10 h-10" />}
                  onClick={() => navigateTo("WATERMARK_REMOVER", "Watermark Remover")}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="Extract Audio" 
                  description="Extract high-quality audio (MP3, WAV) from any video file instantly."
                  icon={<FileArchive className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("mp3"); navigateTo("UNIVERSAL_CONVERTER", "Extract Audio"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="HTML to PDF" 
                  description="Convert webpages in HTML to PDF. Copy and paste the URL of the page you want."
                  icon={<FileText className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("pdf"); navigateTo("UNIVERSAL_CONVERTER", "HTML to PDF"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="Unlock PDF" 
                  description="Remove PDF password security, giving you the freedom to use your PDFs as you want."
                  icon={<FileText className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("pdf"); navigateTo("UNIVERSAL_CONVERTER", "Unlock PDF"); }}
                />
              </div>
            </motion.div>
          )}

          {view === "SECURE_PDF" && (
            <motion.div
              key="secure-pdf"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-7xl mx-auto"
            >
              <button 
                onClick={() => navigateTo("HUB")}
                className="flex items-center space-x-2 text-sm font-semibold mb-6 text-slate-500 hover:text-[#e5322d] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Hub</span>
              </button>
              
              <div className={clsx(
                "grid grid-cols-1 md:grid-cols-4 gap-6 border shadow-lg rounded-2xl overflow-hidden",
                isPremium ? "bg-slate-900/80 border-white/10" : "bg-white border-slate-200 text-slate-900"
              )}>
                {/* Left Sidebar */}
                <div className={clsx("md:col-span-1 border-r p-4", isPremium ? "bg-slate-800/50 border-white/10" : "bg-slate-50")}>
                  <h3 className={clsx("font-bold text-lg mb-4 px-2", isPremium ? "text-white" : "text-slate-800")}>Security Tools</h3>
                  <div className="space-y-2">
                    {["password", "permissions", "watermark", "redact", "metadata"].map(tool => (
                      <button
                        key={tool}
                        onClick={() => setSecureTool(tool)}
                        className={clsx(
                          "w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                          secureTool === tool 
                            ? "bg-[#e5322d] text-white shadow-md" 
                            : isPremium ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {tool === "password" && "Password Protect"}
                        {tool === "permissions" && "Permissions"}
                        {tool === "watermark" && "Watermark"}
                        {tool === "redact" && "Redact"}
                        {tool === "metadata" && "Remove Metadata"}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Center / Right Content */}
                <div className="md:col-span-3 p-6 flex flex-col h-full min-h-[500px]">
                  {!resultUrl ? (
                    <>
                      <div className="mb-8">
                        <h2 className={clsx("text-2xl font-bold mb-2", isPremium ? "text-white" : "text-slate-900")}>
                          {secureTool === "password" && "Password Protect PDF"}
                          {secureTool === "permissions" && "Set PDF Permissions"}
                          {secureTool === "watermark" && "Add Watermark"}
                          {secureTool === "redact" && "Redact Content"}
                          {secureTool === "metadata" && "Remove Metadata"}
                        </h2>
                        <p className={isPremium ? "text-slate-400" : "text-slate-500"}>
                          {secureTool === "password" && "Add a password to restrict who can open this document."}
                          {secureTool === "permissions" && "Restrict printing, copying, and editing."}
                          {secureTool === "watermark" && "Stamp a text watermark over your document pages."}
                          {secureTool === "redact" && "Permanently black out text in your PDF."}
                          {secureTool === "metadata" && "Wipe author, title, and creator tags for privacy."}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
                        <div>
                          <UploadZone 
                            isPremium={isPremium}
                            multiple={false}
                            selectedFiles={files} 
                            onFileRemove={(index) => {
                              setFiles(prev => {
                                const newFiles = [...prev];
                                newFiles.splice(index, 1);
                                if (newFiles.length === 0) resetState();
                                return newFiles;
                              });
                            }}
                            onCancel={() => {
                              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                              setIsProcessing(false);
                              setProgress(0);
                            }}
                            onFileSelect={async (newFiles) => setFiles([newFiles[0]])}
                            onClear={resetState}
                            progress={progress}
                            converting={isProcessing}
                          />
                        </div>

                        <div className={clsx("p-6 rounded-xl border flex flex-col justify-between", isPremium ? "bg-slate-800/50 border-white/10" : "bg-slate-50")}>
                          <div className="space-y-4">
                            {secureTool === "password" && (
                              <div>
                                <Label className={clsx("mb-2 block", isPremium ? "text-slate-300" : "")}>Document Password</Label>
                                <input 
                                  type="password" 
                                  placeholder="Enter secure password" 
                                  className={clsx("w-full border p-3 rounded-md", isPremium ? "bg-slate-900 border-slate-700 text-white" : "text-slate-900")}
                                  value={secureConfig.password || ""}
                                  onChange={e => setSecureConfig({...secureConfig, password: e.target.value})}
                                />
                              </div>
                            )}

                            {secureTool === "permissions" && (
                              <div className="space-y-3">
                                {['print', 'copy', 'edit', 'comments', 'fill_forms'].map(p => (
                                  <label key={p} className="flex items-center space-x-3 cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      className="w-4 h-4 rounded text-[#e5322d] focus:ring-[#e5322d]"
                                      checked={secureConfig.permissions?.[p] || false}
                                      onChange={e => setSecureConfig({
                                        ...secureConfig, 
                                        permissions: {...(secureConfig.permissions || {}), [p]: e.target.checked}
                                      })}
                                    />
                                    <span className={clsx("text-sm font-medium capitalize", isPremium ? "text-slate-300" : "text-slate-700")}>{p.replace('_', ' ')}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {secureTool === "watermark" && (
                              <div>
                                <Label className={clsx("mb-2 block", isPremium ? "text-slate-300" : "")}>Watermark Text</Label>
                                <input 
                                  type="text" 
                                  placeholder="CONFIDENTIAL" 
                                  className={clsx("w-full border p-3 rounded-md", isPremium ? "bg-slate-900 border-slate-700 text-white" : "text-slate-900")}
                                  value={secureConfig.text || ""}
                                  onChange={e => setSecureConfig({...secureConfig, text: e.target.value})}
                                />
                              </div>
                            )}

                            {secureTool === "redact" && (
                              <div>
                                <Label className={clsx("mb-2 block", isPremium ? "text-slate-300" : "")}>Text to Redact</Label>
                                <input 
                                  type="text" 
                                  placeholder="e.g. John Doe, SSN, etc." 
                                  className={clsx("w-full border p-3 rounded-md mb-2", isPremium ? "bg-slate-900 border-slate-700 text-white" : "text-slate-900")}
                                  value={secureConfig.text || ""}
                                  onChange={e => setSecureConfig({...secureConfig, text: e.target.value})}
                                />
                                <p className="text-xs text-red-500 font-medium">
                                  Warning: Redaction permanently removes the matching text from the document.
                                </p>
                              </div>
                            )}

                            {secureTool === "metadata" && (
                              <div>
                                <p className={clsx("text-sm", isPremium ? "text-slate-400" : "text-slate-600")}>
                                  Clicking 'Apply Security' will completely wipe all metadata (Author, Title, Creator, Producer) from the uploaded PDF.
                                </p>
                              </div>
                            )}
                          </div>

                          <Button
                            onClick={handleProcess}
                            disabled={isProcessing || files.length === 0}
                            size="lg"
                            className="w-full h-12 mt-6 bg-[#e5322d] hover:bg-[#c42824] text-white"
                          >
                            <Shield className="w-5 h-5 mr-2" />
                            Apply Security
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <div className="p-4 rounded-full mb-6 bg-green-100 text-green-600">
                        <CheckCircle2 className="w-16 h-16" />
                      </div>
                      <h3 className="text-3xl font-extrabold mb-4 text-slate-800">
                        PDF Secured Successfully ✓
                      </h3>
                      <p className="mb-8 text-lg text-slate-600">
                        Operations applied: {secureTool}
                      </p>
                      
                      <div className="flex flex-col gap-4 w-full justify-center sm:w-auto mx-auto">
                        <Button 
                          size="lg"
                          onClick={async () => {
                            try {
                              const res = await fetch(resultUrl);
                              const blob = await res.blob();
                              const blobUrl = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = blobUrl;
                              a.download = resultFilename ? resultFilename : `secured_${files[0]?.name || 'file.pdf'}`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            } catch (e) {
                              console.error("Download failed", e);
                              window.open(resultUrl, "_blank");
                            }
                          }}
                          className="w-full sm:w-auto min-w-[200px] h-14 text-lg font-bold bg-[#e5322d] hover:bg-[#c42824]"
                        >
                          <Download className="w-5 h-5 mr-2" />
                          Download Secured PDF
                        </Button>
                        <Button 
                          variant="outline"
                          size="lg"
                          onClick={resetState}
                          className="w-full sm:w-auto min-w-[200px] h-14"
                        >
                          Secure Another PDF
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view !== "HUB" && view !== "SECURE_PDF" && (
            <motion.div
              key="tool"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto"
            >
              <button 
                onClick={() => navigateTo("HUB")}
                className="flex items-center space-x-2 text-sm font-semibold mb-6 text-slate-500 hover:text-[#e5322d] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Hub</span>
              </button>

              <div className={clsx(
                "rounded-3xl p-8 sm:p-12 border transition-all duration-500",
                isPremium 
                  ? "bg-slate-900/60 border-white/10 shadow-2xl backdrop-blur-xl" 
                  : "bg-white border-slate-200 shadow-xl shadow-slate-200/50"
              )}>
                <div className="text-center mb-10">
                  <h2 className={clsx(
                    "text-3xl font-bold tracking-tight mb-3",
                    isPremium ? "text-white" : "text-slate-900"
                  )}>
                    {activeToolTitle || (
                      <>
                        {view === "UNIVERSAL_CONVERTER" && "Convert Any File"}
                        {view === "WATERMARK_REMOVER" && "Remove Watermark"}
                        {view === "PDF_TO_EXCEL" && "Extract to Excel Template"}
                      </>
                    )}
                  </h2>
                  <p className={clsx("text-lg", isPremium ? "text-slate-400" : "text-slate-500")}>
                    {activeToolTitle ? `Upload your file below to start the ${activeToolTitle} process.` : (
                      <>
                        {view === "UNIVERSAL_CONVERTER" && "Upload a Document, Image, Video, Audio, or Archive."}
                        {view === "WATERMARK_REMOVER" && "Clean up your media effortlessly."}
                        {view === "PDF_TO_EXCEL" && "Upload a PDF/Word file to extract its data into a structured Excel format."}
                      </>
                    )}
                  </p>
                </div>

                <div className="space-y-8 max-w-2xl mx-auto">
                  {!resultUrl ? (
                    <>
                      <UploadZone 
                        isPremium={isPremium}
                        multiple={activeToolTitle === "Merge PDF"}
                        selectedFiles={files} 
                        onFileRemove={(index) => {
                          setFiles(prev => {
                            const newFiles = [...prev];
                            newFiles.splice(index, 1);
                            if (newFiles.length === 0) {
                              resetState(); 
                            }
                            return newFiles;
                          });
                        }}
                        onCancel={() => {
                          if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                            pollIntervalRef.current = null;
                          }
                          setIsProcessing(false);
                          setProgress(0);
                        }}
                        onFileSelect={async (newFiles) => {
                          const isMerge = activeToolTitle === "Merge PDF";
                          const limitMB = isPremium ? Infinity : 350; 
                          
                          for (const f of newFiles) {
                            const fileSizeMB = f.size / (1024 * 1024);
                            if (fileSizeMB > limitMB) {
                              setRejectedFileSize(fileSizeMB);
                              setShowPremiumGate(true);
                              return;
                            }
                          }

                          if (isMerge) {
                            setFiles(prev => [...prev, ...newFiles]);
                          } else {
                            setFiles([newFiles[0]]);
                          }
                          
                          if (view === "UNIVERSAL_CONVERTER") {
                            const { getAvailableTargetFormats, detectCategory } = await import('@/lib/conversions');
                            const formats = getAvailableTargetFormats(newFiles[0].name);
                            const cat = detectCategory(newFiles[0].name);
                            
                            if (formats.length === 0) {
                              setError("Unsupported file format.");
                            } else {
                              setAvailableFormats(formats);
                              if (!targetFormat || !formats.includes(targetFormat)) {
                                setTargetFormat(formats[0]);
                              }
                              setDetectedCategory(cat);
                            }
                          }
                        }}
                        onClear={resetState}
                        progress={progress}
                        converting={isProcessing}
                      />

                      {files.length > 0 && !isProcessing && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex flex-col sm:flex-row items-end gap-4 bg-slate-500/5 p-4 rounded-xl border border-slate-500/10"
                        >
                          {view === "AUDIO_CONVERTER" && (
                            <div className="flex-1 w-full flex items-center gap-4">
                              <div className="flex-1">
                                <Label className="text-xs mb-1 block">From</Label>
                                <select 
                                  value={sourceAudioFormat} 
                                  onChange={(e) => setSourceAudioFormat(e.target.value)}
                                  className={clsx("w-full rounded-md border px-3 py-2 text-sm", isPremium ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200")}
                                >
                                  {["mp3", "wav", "ogg", "aac", "m4a", "flac", "wma", "aiff", "opus"].map(fmt => (
                                    <option key={fmt} value={fmt}>{fmt.toUpperCase()}</option>
                                  ))}
                                </select>
                              </div>
                              <ArrowLeft className="w-5 h-5 text-slate-400 rotate-180 mt-4" />
                              <div className="flex-1">
                                <Label className="text-xs mb-1 block">To</Label>
                                <select 
                                  value={targetAudioFormat} 
                                  onChange={(e) => setTargetAudioFormat(e.target.value)}
                                  className={clsx("w-full rounded-md border px-3 py-2 text-sm", isPremium ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200")}
                                >
                                  {["mp3", "wav", "ogg", "aac", "m4a", "flac", "wma", "aiff", "opus"].filter(fmt => fmt !== sourceAudioFormat).map(fmt => (
                                    <option key={fmt} value={fmt}>{fmt.toUpperCase()}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}

                          {view === "WATERMARK_REMOVER" && (
                            <div className="flex-1 w-full">
                              <Label className="text-xs mb-1 block">Watermark Position</Label>
                              <select 
                                value={watermarkPos} 
                                onChange={(e) => setWatermarkPos(e.target.value)}
                                className={clsx("w-full rounded-md border px-3 py-2 text-sm", isPremium ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200")}
                              >
                                <option value="top_left">Top Left</option>
                                <option value="top_right">Top Right</option>
                                <option value="center">Center</option>
                                <option value="bottom_left">Bottom Left</option>
                                <option value="bottom_right">Bottom Right</option>
                              </select>
                            </div>
                          )}

                          {view === "UNIVERSAL_CONVERTER" && 
                           !activeToolTitle?.startsWith("Compress") && 
                           !activeToolTitle?.includes("Merge") && 
                           !activeToolTitle?.includes("Split") && 
                           !activeToolTitle?.includes("to") && (
                            <div className="flex-1 w-full">
                              <FormatPicker 
                                formats={availableFormats} 
                                selectedFormat={targetFormat}
                                onSelect={setTargetFormat}
                              />
                              {detectedCategory !== "Unknown" && (
                                <p className="text-xs text-muted-foreground mt-2 ml-1">
                                  Detected Type: {detectedCategory}
                                </p>
                              )}
                            </div>
                          )}
                          
                          {activeToolTitle === "Split PDF" && (
                            <div className="flex-1 w-full flex items-center gap-3 bg-white p-2 rounded-lg border">
                              <span className="text-sm font-medium text-slate-700 pl-2">Split after page:</span>
                              <input 
                                type="number" 
                                min="1" 
                                value={splitPage}
                                onChange={(e) => setSplitPage(parseInt(e.target.value) || 1)}
                                className="w-20 p-2 border rounded-md text-sm outline-none focus:border-blue-500"
                              />
                            </div>
                          )}

                          <Button
                            onClick={handleProcess}
                            disabled={isProcessing || files.length === 0}
                            size="lg"
                            className={clsx(
                              "w-full sm:w-auto min-w-[200px] h-14 text-lg font-bold shadow-lg transition-all hover:scale-105 active:scale-95",
                              isPremium 
                                ? "bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white shadow-purple-500/25" 
                                : "bg-slate-900 hover:bg-slate-800 text-white"
                            )}
                          >
                            <Settings className="w-5 h-5 mr-2" />
                            {view === "WATERMARK_REMOVER" ? (
                              <><Eraser className="w-5 h-5 mr-2" /> Clean File</>
                            ) : view === "PDF_TO_EXCEL" ? (
                              <><FileSpreadsheet className="w-5 h-5 mr-2" /> Extract to Excel</>
                            ) : activeToolTitle?.startsWith("Compress") ? (
                              "Compress Now"
                            ) : activeToolTitle === "Merge PDF" ? (
                              "Merge Now"
                            ) : activeToolTitle === "Split PDF" ? (
                              "Split Now"
                            ) : (
                              "Convert Now"
                            )}
                          </Button>
                        </motion.div>
                      )}
                    </>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center justify-center p-12 text-center"
                    >
                      <div className={clsx("p-4 rounded-full mb-6", isPremium ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-600")}>
                        <CheckCircle2 className="w-16 h-16" />
                      </div>
                      <h3 className={clsx("text-3xl font-extrabold mb-4", isPremium ? "text-white" : "text-slate-800")}>
                        Task completed!
                      </h3>
                      <p className={clsx("mb-8 text-lg", isPremium ? "text-slate-400" : "text-slate-600")}>
                        Your file has been processed successfully.
                      </p>
                      
                      <div className="flex flex-col gap-4 w-full justify-center sm:w-auto mx-auto">
                        <Button 
                          size="lg"
                          onClick={async () => {
                            try {
                              const res = await fetch(resultUrl);
                              const blob = await res.blob();
                              const blobUrl = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = blobUrl;
                              const extMatch = resultFilename ? resultFilename.match(/\.([a-zA-Z0-9]+)$/) : null;
                              const ext = extMatch ? extMatch[1] : (targetFormat || 'pdf');

                              a.download = view === "WATERMARK_REMOVER" 
                                ? `cleaned_${files[0]?.name || 'file'}`
                                : view === "PDF_TO_EXCEL"
                                ? `template_${files[0]?.name.split('.')[0] || 'data'}.xlsx`
                                : `converted.${ext}`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              window.URL.revokeObjectURL(blobUrl);
                            } catch (e) {
                              console.error("Download failed", e);
                              // Fallback if fetch fails (e.g. CORS)
                              window.open(resultUrl, '_blank');
                            }
                          }}
                          className={clsx(
                            "h-14 px-8 text-lg font-bold shadow-lg transition-all hover:scale-105 active:scale-95",
                            isPremium 
                              ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white shadow-green-500/25" 
                              : "bg-green-600 hover:bg-green-500 text-white"
                          )}
                        >
                          <Download className="w-6 h-6 mr-3" />
                          Download Result
                        </Button>
                        <Button 
                          variant="ghost" 
                          onClick={resetState}
                          className={clsx("font-semibold mt-4", isPremium ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")}
                        >
                          Process another file
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <PremiumGate 
        isOpen={showPremiumGate} 
        onClose={() => setShowPremiumGate(false)} 
        fileSizeMB={rejectedFileSize} 
        limitMB={10} 
      />
    </div>
  );
}
