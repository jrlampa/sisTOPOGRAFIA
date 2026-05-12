import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  position?: "left" | "right";
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const SIZE_MAP = {
  sm: "max-w-xs",
  md: "max-w-sm",
  lg: "max-w-md",
};

export function Drawer({
  isOpen,
  onClose,
  title,
  position = "left",
  children,
  size = "md",
}: DrawerProps) {
  const drawerRef = React.useRef<HTMLDivElement>(null);
  useFocusTrap(drawerRef);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const slideDirection = position === "left" ? -256 : 256;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            className={`
              fixed inset-y-0 ${position}-0
              ${SIZE_MAP[size]} w-full
              bg-app-shell-bg border-r border-app-sidebar-border
              z-50 md:hidden
              flex flex-col
            `}
            initial={{ x: slideDirection }}
            animate={{ x: 0 }}
            exit={{ x: slideDirection }}
            transition={{ type: "spring", damping: 20 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-app-panel-border">
              {title && <h2 className="font-semibold text-lg">{title}</h2>}
              <button
                onClick={onClose}
                aria-label="Close drawer"
                className="p-2 hover:bg-surface-soft rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
