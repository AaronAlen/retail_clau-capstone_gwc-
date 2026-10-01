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
    <div className="min-h-screen bg-gradient-to-br from-stone-900 via-stone-950 to-black flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-stone-900/90 backdrop-blur-xl border border-stone-800 rounded-3xl p-7 shadow-2xl space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-stone-950 shadow-lg shadow-orange-500/20 mb-1">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Velocity Retail</h1>
          <p className="text-xs text-stone-400">Autonomous AI Showroom & Merchandising Engine</p>
        </div>

        {/* Tab Toggle: Sign In vs Create Account */}
        <div className="grid grid-cols-2 bg-stone-950 p-1.5 rounded-2xl border border-stone-800">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setError("");
            }}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              !isRegister
                ? "bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20"
                : "text-stone-400 hover:text-white"
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
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              isRegister
                ? "bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20"
                : "text-stone-400 hover:text-white"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="text-xs font-semibold text-rose-300 bg-rose-950/60 border border-rose-800/80 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="text-xs font-bold text-stone-300">Full Name</label>
              <input
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-stone-950/80 border border-stone-800 text-white placeholder-stone-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                type="text"
                required
              />
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-stone-300">Work Email</label>
            <input
              className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-stone-950/80 border border-stone-800 text-white placeholder-stone-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. employee@velocity.com"
              type="email"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-stone-300">Password</label>
            <input
              className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-stone-950/80 border border-stone-800 text-white placeholder-stone-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              type="password"
              required
            />
          </div>

          {isRegister && (
            <div>
              <label className="text-xs font-bold text-stone-300">Assigned Store Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-stone-950/80 border border-stone-800 text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all cursor-pointer"
              >
                <option value="staff">Staff Cashier (POS & Sales Access)</option>
                <option value="manager">Floor Manager (Inventory & Merchandising)</option>
                <option value="admin">Store Administrator (Full Control)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-black text-sm tracking-wide shadow-lg shadow-orange-500/25 transition-all active:scale-[0.99] disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Processing..." : isRegister ? "Create Account & Sign In" : "Sign In to Dashboard"}
          </button>
        </form>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-500 pt-1 border-t border-stone-800/80">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Protected by HttpOnly Secure JWT Session Cookies</span>
        </div>

        {/* Optional Quick Demo Autofill Pills (Only fills on click, never default!) */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2 justify-center text-[10px] uppercase font-bold tracking-wider text-stone-500">
            <KeyRound className="w-3 h-3 text-amber-500" />
            <span>Quick Demo Role Autofill</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleDemoFill("admin@velocity.com", "admin123")}
              className="px-2.5 py-1.5 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-[11px] font-bold text-stone-300 hover:text-white transition-colors text-center"
            >
              👑 Admin
            </button>
            <button
              type="button"
              onClick={() => handleDemoFill("manager@velocity.com", "manager123")}
              className="px-2.5 py-1.5 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-[11px] font-bold text-stone-300 hover:text-white transition-colors text-center"
            >
              👔 Manager
            </button>
            <button
              type="button"
              onClick={() => handleDemoFill("staff@velocity.com", "staff123")}
              className="px-2.5 py-1.5 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-[11px] font-bold text-stone-300 hover:text-white transition-colors text-center"
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
