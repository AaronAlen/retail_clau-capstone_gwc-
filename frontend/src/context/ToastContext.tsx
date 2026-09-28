import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  title?: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info", title?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, title }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4">
        {toasts.map((toast) => {
          const isSuccess = toast.type === "success";
          const isError = toast.type === "error";
          const isWarning = toast.type === "warning";

          const borderColor = isSuccess
            ? "border-emerald-500/50 shadow-emerald-500/20"
            : isError
            ? "border-rose-500/50 shadow-rose-500/20"
            : isWarning
            ? "border-amber-500/50 shadow-amber-500/20"
            : "border-sky-500/50 shadow-sky-500/20";

          const iconColor = isSuccess
            ? "text-emerald-400"
            : isError
            ? "text-rose-400"
            : isWarning
            ? "text-amber-400"
            : "text-sky-400";

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl bg-stone-950/90 backdrop-blur-xl border ${borderColor} text-white shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-3`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className={`w-5 h-5 ${iconColor}`} />}
                {isError && <XCircle className={`w-5 h-5 ${iconColor}`} />}
                {isWarning && <AlertTriangle className={`w-5 h-5 ${iconColor}`} />}
                {!isSuccess && !isError && !isWarning && <Info className={`w-5 h-5 ${iconColor}`} />}
              </div>
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <h5 className="text-xs font-black text-white uppercase tracking-wider mb-0.5">
                    {toast.title}
                  </h5>
                )}
                <p className="text-xs font-medium text-stone-200 leading-snug whitespace-pre-line">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-stone-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if invoked outside provider
    return {
      showToast: (msg: string) => {
        console.log("[Toast fallback]:", msg);
      },
    };
  }
  return context;
};
