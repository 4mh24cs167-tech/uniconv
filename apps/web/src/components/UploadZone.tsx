"use client";

import { useState, useCallback } from "react";
import { UploadCloud, FileImage, X } from "lucide-react";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";

export interface UploadZoneProps {
  onFileSelect: (files: File[]) => void;
  selectedFiles: File[];
  onClear: () => void;
  onFileRemove?: (index: number) => void;
  onCancel?: () => void;
  progress?: number;
  converting?: boolean;
  isPremium?: boolean;
  multiple?: boolean;
}

export function UploadZone({ 
  onFileSelect, 
  selectedFiles, 
  onClear,
  onFileRemove,
  onCancel,
  progress = 0,
  converting = false,
  isPremium = false,
  multiple = false
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      onFileSelect(multiple ? filesArray : [filesArray[0]]);
    }
  }, [multiple, onFileSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      onFileSelect(multiple ? filesArray : [filesArray[0]]);
    }
  }, [multiple, onFileSelect]);

  return (
    <div className="w-full">
      <label
        htmlFor="file-upload"
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={clsx(
          "relative flex flex-col items-center justify-center w-full min-h-[280px] p-12 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300",
          isDragging 
            ? "border-purple-500 bg-purple-50 scale-[1.02]" 
            : isPremium 
              ? "border-slate-700 bg-slate-900/50 hover:bg-slate-800" 
              : "border-slate-300 bg-slate-50 hover:bg-slate-100",
          converting && "pointer-events-none opacity-50"
        )}
      >
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className={clsx(
            "p-4 rounded-full transition-colors",
            isDragging ? "bg-purple-100 text-purple-600" : isPremium ? "bg-slate-800 text-slate-400" : "bg-white text-slate-400 shadow-sm"
          )}>
            <UploadCloud className="w-10 h-10" />
          </div>
          <div>
            <p className={clsx("text-xl font-bold mb-2", isPremium ? "text-white" : "text-slate-700")}>
              {multiple ? "Drop files here or click to upload" : "Drop file here or click to upload"}
            </p>
            <p className={clsx("text-sm", isPremium ? "text-slate-400" : "text-slate-500")}>
              Supports all major formats up to 350MB (Free) or Unlimited (Premium)
            </p>
          </div>
        </div>
      </label>

      <input
        type="file"
        id="file-upload"
        className="hidden"
        onChange={handleChange}
        multiple={multiple}
      />

      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={clsx(
              "mt-6 bg-white rounded-xl shadow-sm border overflow-hidden",
              isPremium ? "border-purple-500/20 bg-slate-900" : "border-slate-200"
            )}
          >
            {selectedFiles.map((f, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 border-b border-slate-100 last:border-0">
                <div className={clsx("p-3 rounded-lg flex-shrink-0", isPremium ? "bg-purple-500/20 text-purple-400" : "bg-blue-50 text-blue-600")}>
                  <FileImage className="w-6 h-6" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className={clsx("text-sm font-bold truncate", isPremium ? "text-white" : "text-slate-900")}>{f.name}</p>
                  <p className={clsx("text-xs font-medium mt-1", isPremium ? "text-slate-400" : "text-slate-500")}>
                    {(f.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                {!converting && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onFileRemove) {
                        onFileRemove(i);
                      } else {
                        // Fallback logic
                        const newFiles = [...selectedFiles];
                        newFiles.splice(i, 1);
                        if (newFiles.length === 0) onClear();
                        else onFileSelect(newFiles);
                      }
                    }}
                    className={clsx(
                      "p-2 rounded-full transition-colors flex-shrink-0",
                      isPremium ? "hover:bg-red-500/20 text-slate-400 hover:text-red-400" : "hover:bg-red-50 text-slate-400 hover:text-red-500"
                    )}
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
            
            {converting && (
              <div className="p-5 bg-slate-50 border-t border-slate-100">
                <div className={clsx("flex justify-between items-center mb-3 text-sm font-bold", isPremium ? "text-slate-300" : "text-slate-700")}>
                  <span>Processing...</span>
                  <div className="flex items-center gap-4">
                    <span>{progress}%</span>
                    {onCancel && (
                      <button 
                        onClick={onCancel}
                        className="text-xs font-semibold text-red-500 hover:text-red-700 hover:underline transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
                <Progress value={progress} className={clsx("h-2.5", isPremium ? "bg-slate-800" : "bg-slate-200")} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
