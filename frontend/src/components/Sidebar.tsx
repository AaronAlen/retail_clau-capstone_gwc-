import React from "react";
import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store/store";
import { LuSparkles as Sparkles, LuX as X } from "react-icons/lu";

interface SidebarProps {
  onOpenCopilot?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const tabs = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/products", label: "Products", icon: "🛍️" },
  { to: "/inventory", label: "Inventory", icon: "📦" },
  { to: "/recommendations", label: "Recommendations", icon: "✨" },
  { to: "/orders", label: "Orders", icon: "🧾" },
  { to: "/users", label: "Users", icon: "👥", adminOnly: true },
];

const Sidebar: React.FC<SidebarProps> = ({ onOpenCopilot, isOpen = false, onClose }) => {
  const user = useSelector((state: RootState) => state.auth.user);

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand Header */}
        <div className="px-5 py-5 sm:py-6 border-b border-orange-400/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[#EA580C] font-black text-xs shadow-md shadow-black/10">
              VR
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight">
                Velocity Retail
              </h1>
              <p className="text-[10px] text-orange-100 font-medium">Luxury Flagship Studio</p>
            </div>
          </div>

          {/* Close button for mobile / tablet drawer */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-xl text-orange-100 hover:text-white bg-black/20 hover:bg-black/30 transition-colors cursor-pointer"
              title="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <nav className="px-3 py-4 space-y-1.5">
          {tabs
            .filter((t) => !t.adminOnly || user?.role === "admin")
            .map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === "/"}
                onClick={() => onClose?.()}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-white text-[#C2410C] font-extrabold shadow-md shadow-orange-950/20"
                      : "text-orange-50 hover:bg-white/15 hover:text-white font-medium"
                  }`
                }
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="font-semibold">{tab.label}</span>
              </NavLink>
            ))}

          {/* AI Copilot Quick Button in Sidebar */}
          {onOpenCopilot && (
            <button
              onClick={() => {
                onClose?.();
                onOpenCopilot();
              }}
              className="w-full mt-4 flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold text-white bg-white/15 hover:bg-white/25 border border-white/30 transition-all shadow-md group cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-200 group-hover:rotate-12 transition-transform" />
                <span>AI Store Copilot</span>
              </span>
              <span className="text-[10px] bg-white text-[#EA580C] px-2 py-0.5 rounded font-black uppercase">
                Groq
              </span>
            </button>
          )}
        </nav>
      </div>
    </div>
  );

  return (
    <>
      {/* 💻 Desktop Sidebar (Sticky, visible on lg and up) */}
      <aside className="hidden lg:flex w-64 shrink-0 h-screen sticky top-0 bg-gradient-to-b from-[#EA580C] via-[#D9530F] to-[#C2410C] flex-col justify-between shadow-2xl border-r border-[#9A3412]/40 text-white z-30">
        {sidebarContent}
      </aside>

      {/* 📱 Mobile & Tablet Slide-over Drawer (Visible on < lg when isOpen) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
            onClick={onClose}
          />

          {/* Slide Drawer */}
          <aside className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-gradient-to-b from-[#EA580C] via-[#D9530F] to-[#C2410C] shadow-2xl text-white z-50 flex flex-col justify-between animate-in slide-in-from-left duration-300 ease-out border-r border-orange-400/30">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};

export default Sidebar;
