"use client";

import { useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { FormatPicker } from "@/components/FormatPicker";
import { ToolCard } from "@/components/ToolCard";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Download, Eraser, ArrowLeft, FileText, FileImage, FileSpreadsheet, FileArchive, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { PremiumGate } from "@/components/PremiumGate";

type ViewState = "HUB" | "UNIVERSAL_CONVERTER" | "WATERMARK_REMOVER" | "PDF_TO_EXCEL";

export default function Home() {
  const [isPremium, setIsPremium] = useState(false);
  const [view, setView] = useState<ViewState>("HUB");
  const [activeToolTitle, setActiveToolTitle] = useState<string>("");

  // Shared state for the active tool
  const [file, setFile] = useState<File | null>(null);
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
    setFile(null);
    setTargetFormat("");
    setIsProcessing(false);
    setProgress(0);
    setResultUrl(null);
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
    if (!file) return;
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    const isWatermark = view === "WATERMARK_REMOVER";
    const isExcelTemplate = view === "PDF_TO_EXCEL";
    const endpoint = isWatermark ? "/api/remove-watermark" : "/api/convert";
    const isLargeFile = file.size > 20 * 1024 * 1024; // > 20MB

    try {
      if (isLargeFile) {
        // TUS Chunked Upload
        const { uploadFileToSupabaseResumable } = await import('@/lib/upload');
        const fileName = await uploadFileToSupabaseResumable(file, "uploads", (p) => {
          setProgress(Math.floor(p / 2));
        });

        let simProgress = 50;
        const simInterval = setInterval(() => {
          simProgress += 10;
          setProgress(simProgress);
          if (simProgress >= 90) clearInterval(simInterval);
        }, 1000);

        await new Promise(r => setTimeout(r, 4000));
        clearInterval(simInterval);
        
        setProgress(100);
        setResultUrl("#"); 
      } else {
        const interval = setInterval(() => {
          setProgress((p) => {
            if (p >= 90) {
              clearInterval(interval);
              return 90;
            }
            return p + 10;
          });
        }, 200);

        const formData = new FormData();
        formData.append("file", file);
        
        if (!isWatermark && !isExcelTemplate) {
          formData.append("format", targetFormat);
        } else if (isExcelTemplate) {
          formData.append("format", "xlsx"); // mock extracting to template
        }

        const res = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error(await res.text());
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setResultUrl(url);
        setProgress(100);
        clearInterval(interval);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during processing.");
      setProgress(0);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={clsx(
      "min-h-screen transition-colors duration-500 font-sans",
      isPremium ? "dark bg-slate-950 text-slate-50" : "bg-slate-50 text-slate-900"
    )}>
      
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
            <a href="/login" className={clsx(
              "text-sm font-semibold transition-colors",
              isPremium ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
            )}>
              Log in
            </a>
            <div className="flex items-center gap-2 border-l border-slate-300/50 pl-4">
              <Switch id="premium-mode" checked={isPremium} onCheckedChange={setIsPremium} />
              <Label htmlFor="premium-mode" className={clsx(
                "text-sm font-semibold cursor-pointer",
                isPremium ? "text-purple-400" : "text-slate-500"
              )}>
                Premium UI
              </Label>
            </div>
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
                  title="Edit PDF" 
                  description="Add text, images, shapes or freehand annotations to a PDF document."
                  icon={<FileText className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("pdf"); navigateTo("UNIVERSAL_CONVERTER", "Edit PDF"); }}
                />
                <ToolCard 
                  isPremium={isPremium}
                  title="PDF to JPG" 
                  description="Convert each PDF page into a JPG or extract all images contained in a PDF."
                  icon={<FileImage className="w-10 h-10" />}
                  onClick={() => { setTargetFormat("jpg"); navigateTo("UNIVERSAL_CONVERTER", "PDF to JPG"); }}
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

          {view !== "HUB" && (
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
                        selectedFile={file} 
                        onFileSelect={async (f) => {
                          // Free limit logic simulation before backend enforcement
                          const limitMB = 10; // Guest limit
                          const fileSizeMB = f.size / (1024 * 1024);
                          if (fileSizeMB > limitMB && !isPremium) {
                            setRejectedFileSize(fileSizeMB);
                            setShowPremiumGate(true);
                            return;
                          }

                          setFile(f);
                          setError(null);
                          
                          if (view === "UNIVERSAL_CONVERTER") {
                            const { getAvailableTargetFormats, detectCategory } = await import('@/lib/conversions');
                            const formats = getAvailableTargetFormats(f.name);
                            const cat = detectCategory(f.name);
                            
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
                        onClear={() => resetState()}
                        progress={progress}
                        converting={isProcessing}
                      />

                      {file && !isProcessing && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex flex-col sm:flex-row items-center gap-4 bg-slate-500/5 p-4 rounded-xl border border-slate-500/10"
                        >
                          {view === "UNIVERSAL_CONVERTER" && (
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
                          <Button 
                            size="lg"
                            onClick={handleProcess} 
                            className={clsx(
                              "w-full sm:w-auto font-bold mt-7",
                              isPremium ? "bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white border-0 shadow-lg shadow-purple-500/25" : ""
                            )}
                            disabled={view === "UNIVERSAL_CONVERTER" && availableFormats.length === 0}
                          >
                            {view === "WATERMARK_REMOVER" ? (
                              <><Eraser className="w-5 h-5 mr-2" /> Clean File</>
                            ) : view === "PDF_TO_EXCEL" ? (
                              <><FileSpreadsheet className="w-5 h-5 mr-2" /> Extract to Excel</>
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
                          onClick={() => {
                            const a = document.createElement('a');
                            a.href = resultUrl;
                            a.download = view === "WATERMARK_REMOVER" 
                              ? `cleaned_${file?.name || 'file'}`
                              : view === "PDF_TO_EXCEL"
                              ? `template_${file?.name.split('.')[0] || 'data'}.xlsx`
                              : `converted.${targetFormat}`;
                            a.click();
                          }}
                          className={clsx(
                            "gap-3 font-bold text-lg px-12 py-8 rounded-xl shadow-xl",
                            isPremium ? "bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white border-0 shadow-purple-500/25" : ""
                          )}
                        >
                          <Download className="w-6 h-6" /> Download File
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
