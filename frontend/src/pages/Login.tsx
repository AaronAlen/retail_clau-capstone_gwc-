import { FormEvent, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { setCredentials } from "../store/slices/authSlice";
import api from "../services/api";
import {
  LuShieldCheck as ShieldCheck,
  LuLogIn as LogIn,
  LuKeyRound as KeyRound,
  LuSparkles as Sparkles,
} from "react-icons/lu";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Login existing user with HttpOnly cookie session
      const { data } = await api.post("/auth/login", { email, password });
      dispatch(setCredentials(data));
      navigate("/");
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.message : null;
      setError(message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#F8F3EA] flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Warm Ambient Subtle Halos (Matching App Linen Theme) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 left-10 w-80 h-80 bg-orange-400/5 rounded-full blur-3xl pointer-events-none" />

      {/* Luxury Boutique White Card */}
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl border border-[#E5D7BE] rounded-3xl p-8 shadow-xl shadow-stone-900/5 space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/25 mb-1">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-stone-900">Velocity Retail</h1>
          <p className="text-xs text-stone-500 font-medium">Autonomous AI Showroom & Merchandising Engine</p>
        </div>

        {/* Portal Access Header */}
        <div className="text-center pb-1 border-b border-[#E5D7BE]/70">
          <h2 className="text-xs font-black uppercase tracking-wider text-orange-800 flex items-center justify-center gap-1.5">
            <LogIn className="w-3.5 h-3.5" />
            <span>Store Personnel Authentication</span>
          </h2>
          <p className="text-[11px] text-stone-400 mt-0.5">
            Authorized access only. New personnel must be registered by Store Admin.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-stone-700">Work Email</label>
            <input
              className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-[#FAF5EE] border border-[#E5D7BE] text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all font-medium"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. employee@velocity.com"
              type="email"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-stone-700">Password</label>
            <input
              className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-[#FAF5EE] border border-[#E5D7BE] text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all font-medium"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              type="password"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm tracking-wide shadow-md shadow-orange-500/25 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In to Dashboard"}
          </button>
        </form>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-500 pt-2 border-t border-[#E5D7BE]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Protected by HttpOnly Secure JWT Session Cookies</span>
        </div>

        {/* Quick Demo Autofill Pills (Clean warm linen cards) */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 justify-center text-[10px] uppercase font-bold tracking-wider text-stone-500">
            <KeyRound className="w-3 h-3 text-orange-600" />
            <span>Quick Demo Role Autofill</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleDemoFill("admin@velocity.com", "Velocity@Admin2026!")}
              className="px-2.5 py-2 rounded-xl bg-[#FAF5EE] hover:bg-orange-50 border border-[#E5D7BE] hover:border-orange-400 text-[11px] font-bold text-stone-800 transition-colors text-center cursor-pointer shadow-2xs"
            >
              👑 Admin
            </button>
            <button
              type="button"
              onClick={() => handleDemoFill("manager@velocity.com", "Velocity@Mgr2026!")}
              className="px-2.5 py-2 rounded-xl bg-[#FAF5EE] hover:bg-orange-50 border border-[#E5D7BE] hover:border-orange-400 text-[11px] font-bold text-stone-800 transition-colors text-center cursor-pointer shadow-2xs"
            >
              👔 Manager
            </button>
            <button
              type="button"
              onClick={() => handleDemoFill("staff@velocity.com", "Velocity@Staff2026!")}
              className="px-2.5 py-2 rounded-xl bg-[#FAF5EE] hover:bg-orange-50 border border-[#E5D7BE] hover:border-orange-400 text-[11px] font-bold text-stone-800 transition-colors text-center cursor-pointer shadow-2xs"
            >
              🛒 Cashier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
