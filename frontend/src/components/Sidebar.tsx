import React from "react";
import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store/store";
import { Sparkles } from "lucide-react";

interface SidebarProps {
  onOpenCopilot?: () => void;
}

const tabs = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/products", label: "Products", icon: "🛍️" },
  { to: "/inventory", label: "Inventory", icon: "📦" },
  { to: "/recommendations", label: "Recommendations", icon: "✨" },
  { to: "/orders", label: "Orders", icon: "🧾" },
  { to: "/users", label: "Users", icon: "👥", adminOnly: true },
];

const Sidebar: React.FC<SidebarProps> = ({ onOpenCopilot }) => {
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 bg-gradient-to-b from-[#EA580C] via-[#D9530F] to-[#C2410C] flex flex-col justify-between shadow-2xl border-r border-[#9A3412]/40 text-white z-20">
      <div>
        <div className="px-5 py-6 border-b border-orange-400/30">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-[#EA580C] font-black text-xs shadow-md shadow-black/10">
              VR
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-tight">
                Velocity Retail
              </h1>
              <p className="text-[10px] text-orange-100 font-medium">Luxury Flagship Studio</p>
            </div>
          </div>
        </div>

        <nav className="px-3 py-4 space-y-1.5">
          {tabs
            .filter((t) => !t.adminOnly || user?.role === "admin")
            .map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-white text-[#C2410C] font-extrabold shadow-md shadow-orange-950/20"
                      : "text-orange-50 hover:bg-white/15 hover:text-white font-medium"
                  }`
                }
              >
                <span className="text-base">{tab.icon}</span>
                <span>{tab.label}</span>
              </NavLink>
            ))}

          {/* AI Copilot Quick Button in Sidebar */}
          {onOpenCopilot && (
            <button
              onClick={onOpenCopilot}
              className="w-full mt-4 flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-white/15 hover:bg-white/25 border border-white/30 transition-all shadow-md group cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-200 group-hover:rotate-12 transition-transform" />
                <span>AI Store Copilot</span>
              </span>
              <span className="text-[10px] bg-white text-[#EA580C] px-1.5 py-0.5 rounded font-black uppercase">
                Groq
              </span>
            </button>
          )}
        </nav>
      </div>

      {user && (
        <div className="px-5 py-4 border-t border-orange-400/30 text-xs text-orange-100 bg-black/15">
          Signed in as <span className="font-bold text-white">{user.name}</span>
          <div className="uppercase tracking-wider text-[10px] text-amber-200 font-extrabold mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
            {user.role}
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
