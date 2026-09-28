import { FormEvent, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { setCredentials } from "../store/slices/authSlice";

const Login = () => {
  const [email, setEmail] = useState("admin@velocity.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await axios.post("/api/auth/login", { email, password });
      dispatch(setCredentials(data));
      navigate("/");
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.message : null;
      setError(message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-blue via-brand-violet to-brand-pink bg-clip-text text-transparent">
            Velocity Retail
          </h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to your dashboard</p>
        </div>
        {error && <p className="text-sm text-brand-pink bg-brand-pink/10 rounded-lg px-3 py-2">{error}</p>}
        <div>
          <label className="text-xs font-medium text-slate-500">Email</label>
          <input
            className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Password</label>
          <input
            className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <p className="text-[11px] text-slate-400 text-center">
          Demo: admin@velocity.com / admin123 &middot; manager@velocity.com / manager123 &middot; staff@velocity.com / staff123
        </p>
      </form>
    </div>
  );
};

export default Login;
