import { ReactNode } from "react";
import { clsx } from "clsx";
import { motion } from "framer-motion";

export interface ToolCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  isPremium?: boolean;
}

export function ToolCard({ title, description, icon, onClick, isPremium }: ToolCardProps) {
  return (
    <motion.button
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={clsx(
        "flex flex-col items-center text-center p-6 sm:p-8 rounded-2xl border transition-all duration-300 w-full group",
        isPremium
          ? "bg-slate-900/40 border-white/10 hover:border-purple-500/50 hover:bg-slate-800/60 shadow-xl shadow-black/20"
          : "bg-white border-slate-200 hover:border-blue-500/30 hover:shadow-[0_10px_40px_-15px_rgba(59,130,246,0.15)] shadow-sm"
      )}
      style={{ minHeight: "220px" }}
    >
      <div className={clsx(
        "p-4 rounded-full mb-6 transition-transform duration-300 group-hover:scale-110",
        isPremium ? "bg-purple-500/10 text-purple-400" : "bg-blue-50 text-blue-600"
      )}>
        {icon}
      </div>
      <h3 className={clsx(
        "text-xl font-bold mb-2 tracking-tight",
        isPremium ? "text-slate-100 group-hover:text-purple-300" : "text-slate-900 group-hover:text-blue-600"
      )}>
        {title}
      </h3>
      <p className={clsx(
        "text-sm leading-relaxed",
        isPremium ? "text-slate-400" : "text-slate-500"
      )}>
        {description}
      </p>
    </motion.button>
  );
}
