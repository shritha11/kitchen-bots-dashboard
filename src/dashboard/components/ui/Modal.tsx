import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../utils/cn";
import { Button } from "./Button";
import { Heading, Text } from "./Typography";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  footer,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-overlay bg-background/80 backdrop-blur-sm transition-all"
            role="presentation"
          />
          <div className="fixed inset-0 z-modal flex items-center justify-center pointer-events-none p-4 sm:p-6 md:p-8 overflow-y-auto">
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
              className={cn(
                "w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl pointer-events-auto my-auto",
                className
              )}
            >
              {(title || description) && (
                <div className="flex flex-col space-y-1.5 p-5 sm:p-6 border-b border-border shrink-0 bg-card">
                  <div className="flex items-center justify-between gap-4">
                    {title && <Heading level="h4" className="text-base sm:text-lg font-semibold tracking-tight">{title}</Heading>}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 cursor-pointer"
                      onClick={onClose}
                      aria-label="Close modal"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {description && (
                    <Text variant="muted" className="text-xs text-muted-foreground leading-relaxed">{description}</Text>
                  )}
                </div>
              )}
              {!title && !description && (
                <div className="absolute right-4 top-4 z-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-background/50 hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={onClose}
                    aria-label="Close modal"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="p-5 sm:p-6 overflow-y-auto min-h-0 flex-1 overscroll-contain">{children}</div>
              {footer && (
                <div className="flex items-center justify-end space-x-2 border-t border-border bg-muted/30 px-5 sm:px-6 py-4 shrink-0 sticky bottom-0 z-10">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(modalContent, document.body);
}
