"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PremiumGateProps {
  isOpen: boolean;
  onClose: () => void;
  fileSizeMB: number;
  limitMB: number;
}

export function PremiumGate({ isOpen, onClose, fileSizeMB, limitMB }: PremiumGateProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden pointer-events-auto border border-slate-100"
            >
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-8 text-white relative">
                <button 
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-6 backdrop-blur-md border border-white/30">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Unlock larger file processing</h2>
                <p className="text-purple-100 text-lg">
                  Your file is {fileSizeMB.toFixed(1)} MB. Free users can process files up to {limitMB} MB.
                </p>
              </div>
              
              <div className="p-8">
                <div className="space-y-4 mb-8">
                  {[
                    "Up to 1 GB files",
                    "Batch processing",
                    "More storage",
                    "Advanced comparison",
                    "Priority processing",
                    "Document history"
                  ].map((benefit, i) => (
                    <div key={i} className="flex items-center gap-3 text-slate-700">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                        <Check className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="font-medium">{benefit}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3">
                  <Button className="w-full py-6 text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 shadow-xl shadow-purple-500/25 border-0">
                    Upgrade to Pro
                  </Button>
                  <Button variant="ghost" onClick={onClose} className="text-slate-500 hover:text-slate-800 font-semibold">
                    View Plans
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
