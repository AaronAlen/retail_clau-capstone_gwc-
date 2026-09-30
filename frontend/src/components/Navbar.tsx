import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../store/slices/authSlice";
import { RootState } from "../store/store";
import { Bell, Sparkles, LogOut, AlertCircle, Menu, Download } from "lucide-react";

interface NavbarProps {
  title: string;
  onOpenCopilot?: () => void;
  lowStockItems?: Array<{ name: string; stock: number }>;
  onToggleSidebar?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  title,
  onOpenCopilot,
  lowStockItems = [],
  onToggleSidebar,
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    );
  });

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert(
        "📱 To install Velocity Retail on your device:\n\n• On iOS (Safari): Tap the Share button at the bottom and choose 'Add to Home Screen'.\n• On Android (Chrome): Tap the 3 dots menu and select 'Install App' or 'Add to Home Screen'.\n• On Desktop (Chrome/Edge): Click the Install icon in the browser address bar."
      );
    }
  };

  // Lock body scroll when logout confirmation is open
  useEffect(() => {
    if (showLogoutConfirm) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [showLogoutConfirm]);

  return (
    <header className="flex items-center justify-between px-3 sm:px-6 lg:px-8 py-3 sm:py-4 border-b border-[#E5D7BE] bg-[#F8F3EA]/90 backdrop-blur-md sticky top-0 z-40 shadow-sm">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Mobile / Tablet Hamburger Menu Button */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-xl border border-[#E5D7BE] bg-white text-stone-700 hover:bg-[#F2E8D5] transition-colors shadow-sm cursor-pointer shrink-0"
            title="Open Menu"
          >
            <Menu className="w-5 h-5 text-orange-600" />
          </button>
        )}

        <div className="min-w-0">
          <h2 className="text-base sm:text-xl font-extrabold text-stone-900 tracking-tight truncate">
            {title}
          </h2>
          <p className="text-[10px] sm:text-xs text-stone-500 font-medium truncate hidden xs:block">
            Velocity Luxury Intelligence & 3D Merchandising
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* 📱 PWA Install App Button */}
        {!isInstalled && (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-stone-800 bg-white hover:bg-[#F2E8D5] border border-[#E5D7BE] transition-all shadow-sm hover:scale-[1.02] cursor-pointer shrink-0"
            title="Install Velocity Retail App on your mobile device or computer (PWA)"
          >
            <Download className="w-3.5 h-3.5 text-orange-600" />
            <span className="hidden sm:inline">Install App</span>
            <span className="sm:hidden text-[11px]">Install</span>
          </button>
        )}

        {/* AI Copilot Launch Button */}
        {onOpenCopilot && (
          <button
            onClick={onOpenCopilot}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:brightness-105 shadow-md shadow-orange-500/20 transition-all hover:scale-[1.02] border border-orange-400/40 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span className="hidden sm:inline">AI Copilot</span>
            <span className="sm:hidden">AI</span>
            <span className="text-[9px] sm:text-[10px] bg-white/20 text-white px-1 sm:px-1.5 py-0.5 rounded-full uppercase font-black">
              Groq
            </span>
          </button>
        )}

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications((v) => !v)}
            className="p-1.5 sm:p-2 rounded-xl border border-[#E5D7BE] bg-white text-stone-700 hover:bg-[#F2E8D5] transition-colors relative shadow-sm cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {lowStockItems.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                {lowStockItems.length}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 max-w-[90vw] bg-white rounded-2xl shadow-xl border border-[#E5D7BE] p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-[#E5D7BE] mb-2">
                <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" /> Stock Alerts
                </span>
                <span className="text-[10px] text-orange-600 font-bold">
                  {lowStockItems.length} urgent
                </span>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {lowStockItems.length > 0 ? (
                  lowStockItems.map((item, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-rose-900 truncate max-w-[150px]">
                        {item.name}
                      </span>
                      <span className="text-[11px] font-bold text-rose-700 px-2 py-0.5 rounded-full bg-rose-100">
                        {item.stock} left
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-stone-500 text-center py-4">All stock levels healthy!</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Info & Logout */}
        {user && (
          <div className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-3 border-l border-[#E5D7BE]">
            <div className="w-7 h-7 sm:w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-black text-xs flex items-center justify-center shadow-sm">
              {user.name.charAt(0)}
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-1.5 sm:p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal Portaled to Document Body for True Fullscreen Centering */}
      {showLogoutConfirm &&
        createPortal(
          <div className="fixed inset-0 w-screen h-screen z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            {/* Full-screen backdrop */}
            <div
              className="fixed inset-0 w-full h-full bg-stone-950/60 backdrop-blur-md transition-opacity duration-200"
              onClick={() => setShowLogoutConfirm(false)}
            />
            {/* Modal Dialog Card */}
            <div className="relative z-10 bg-[#FAF5EE] border border-[#E5D7BE] rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-stone-900 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-base">Sign Out?</h3>
                  <p className="text-xs text-stone-500">Are you sure you want to end your session?</p>
                </div>
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E5D7BE] bg-white text-stone-700 hover:bg-[#F2E8D5] text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    dispatch(logout());
                    navigate("/login");
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-rose-500/20"
                >
                  Yes, Sign Out
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
};

export default Navbar;
