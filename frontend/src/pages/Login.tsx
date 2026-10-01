import { FormEvent, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { setCredentials } from "../store/slices/authSlice";
import api from "../services/api";
import { ShieldCheck, UserPlus, LogIn, KeyRound, Sparkles } from "lucide-react";

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "staff">("staff");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) {
        // Register new user into MongoDB with HttpOnly cookie session
        const { data } = await api.post("/auth/register", { name, email, password, role });
        dispatch(setCredentials(data));
        navigate("/");
      } else {
        // Login existing user with HttpOnly cookie session
        const { data } = await api.post("/auth/login", { email, password });
        dispatch(setCredentials(data));
        navigate("/");
      }
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.message : null;
      setError(message || (isRegister ? "Registration failed" : "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (demoEmail: string, demoPass: string) => {
    setIsRegister(false);
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

        {/* Tab Toggle: Sign In vs Create Account */}
        <div className="grid grid-cols-2 bg-[#F8F2E6] p-1.5 rounded-2xl border border-[#E5D7BE]">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setError("");
            }}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              !isRegister
                ? "bg-white text-orange-700 shadow-sm border border-[#E5D7BE]/70 font-black"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setError("");
            }}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isRegister
                ? "bg-white text-orange-700 shadow-sm border border-[#E5D7BE]/70 font-black"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Create Account
          </button>
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
          {isRegister && (
            <div>
              <label className="text-xs font-bold text-stone-700">Full Name</label>
              <input
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-[#FAF5EE] border border-[#E5D7BE] text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all font-medium"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                type="text"
                required
              />
            </div>
          )}

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

          {isRegister && (
            <div>
              <label className="text-xs font-bold text-stone-700">Assigned Store Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-[#FAF5EE] border border-[#E5D7BE] text-stone-900 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all cursor-pointer font-bold"
              >
                <option value="staff">Staff Cashier (POS & Sales Access)</option>
                <option value="manager">Floor Manager (Inventory & Merchandising)</option>
                <option value="admin">Store Administrator (Full Control)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm tracking-wide shadow-md shadow-orange-500/25 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            disabled={loading}
          >
            {loading ? "Processing..." : isRegister ? "Create Account & Sign In" : "Sign In to Dashboard"}
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
              onClick={() => handleDemoFill("admin@velocity.com", "admin123")}
              className="px-2.5 py-2 rounded-xl bg-[#FAF5EE] hover:bg-orange-50 border border-[#E5D7BE] hover:border-orange-400 text-[11px] font-bold text-stone-800 transition-colors text-center cursor-pointer shadow-2xs"
            >
              👑 Admin
            </button>
            <button
              type="button"
              onClick={() => handleDemoFill("manager@velocity.com", "manager123")}
              className="px-2.5 py-2 rounded-xl bg-[#FAF5EE] hover:bg-orange-50 border border-[#E5D7BE] hover:border-orange-400 text-[11px] font-bold text-stone-800 transition-colors text-center cursor-pointer shadow-2xs"
            >
              👔 Manager
            </button>
            <button
              type="button"
              onClick={() => handleDemoFill("staff@velocity.com", "staff123")}
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
