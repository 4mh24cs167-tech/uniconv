"use client";

import { useState, useCallback } from "react";
import { UploadCloud, FileImage, X } from "lucide-react";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";

export interface UploadZoneProps {
  isPremium?: boolean;
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
  progress?: number;
  converting?: boolean;
}

export function UploadZone({
  isPremium = false,
  onFileSelect,
  selectedFile,
  onClear,
  progress = 0,
  converting = false,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFileSelect(e.dataTransfer.files[0]);
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFileSelect(e.target.files[0]);
      }
    },
    [onFileSelect]
  );

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!selectedFile ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className={clsx(
              "relative group border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer overflow-hidden",
              isDragging
                ? (isPremium ? "border-purple-500 bg-purple-500/10" : "border-blue-500 bg-blue-50")
                : (isPremium ? "border-white/10 hover:border-purple-500/50 bg-slate-900/40 hover:bg-slate-800/60" : "border-slate-300 hover:border-blue-400 bg-slate-50"),
              isPremium && "shadow-xl shadow-black/20 hover:shadow-[0_0_40px_-10px_rgba(124,58,237,0.3)]"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={handleFileInput}
            />
            
            <div className="flex flex-col items-center justify-center space-y-4">
              <div
                className={clsx(
                  "p-4 rounded-full transition-transform duration-500",
                  isDragging ? "scale-110" : "group-hover:scale-105",
                  isPremium ? "bg-purple-500/20 text-purple-400" : "bg-primary/10 text-primary"
                )}
              >
                <UploadCloud className="w-8 h-8" />
              </div>
              <div>
                <p className={clsx("text-lg font-semibold", isPremium ? "text-slate-200" : "text-slate-900")}>
                  Click or drag file to this area to upload
                </p>
                <p className={clsx("text-sm mt-1", isPremium ? "text-slate-400" : "text-muted-foreground")}>
                  Supports all file types up to 350MB (Free) or 2GB (Premium)
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={clsx(
              "relative rounded-xl p-6 border transition-all",
              isPremium ? "border-purple-500/30 bg-purple-900/20 backdrop-blur-sm" : "border-border bg-card"
            )}
          >
            <div className="flex items-center space-x-4">
              <div className={clsx("p-3 rounded-lg", isPremium ? "bg-purple-500/20 text-purple-400" : "bg-primary/10 text-primary")}>
                <FileImage className="w-6 h-6" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className={clsx("text-sm font-medium truncate", isPremium ? "text-slate-200" : "text-slate-900")}>{selectedFile.name}</p>
                <p className={clsx("text-xs", isPremium ? "text-slate-400" : "text-muted-foreground")}>
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              {!converting && (
                <button
                  onClick={onClear}
                  className={clsx(
                    "p-2 rounded-full transition-colors",
                    isPremium ? "hover:bg-red-500/20 hover:text-red-400 text-slate-400" : "hover:bg-destructive/10 hover:text-destructive text-slate-500"
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            {converting && (
              <div className="mt-4 space-y-2">
                <div className={clsx("flex justify-between text-xs", isPremium ? "text-slate-300" : "text-muted-foreground")}>
                  <span>Processing...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className={clsx("h-2", isPremium ? "bg-slate-800" : "")} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
