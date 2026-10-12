import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { api, getToken, setToken } from "./lib/api";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Trades from "./pages/Trades";
import Politicians from "./pages/Politicians";
import Issuers from "./pages/Issuers";
import Insights from "./pages/Insights";
import Admin from "./pages/Admin";
import { Toasts } from "./components/ui";

type User = { id: number; email: string; name?: string; role: string };
type Auth = { user: User | null; ready: boolean; login: (t: string) => Promise<void>; logout: () => void };
const Ctx = createContext<Auth>(null as any);
export const useAuth = () => useContext(Ctx);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const loadMe = async () => {
    if (!getToken()) { setUser(null); setReady(true); return; }
    try { const r = await api<{ user: User }>("/me"); setUser(r.user); }
    catch { setToken(null); setUser(null); }
    finally { setReady(true); }
  };
  useEffect(() => { loadMe(); }, []);

  const login = async (t: string) => { setToken(t); await loadMe(); };
  const logout = () => { setToken(null); setUser(null); };

  return (
    <Ctx.Provider value={{ user, ready, login, logout }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Protected />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/politicians" element={<Politicians />} />
            <Route path="/politicians/:id" element={<Politicians />} />
            <Route path="/issuers" element={<Issuers />} />
            <Route path="/issuers/:id" element={<Issuers />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/admin/*" element={<Admin />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
    </Ctx.Provider>
  );
}

function Protected() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="grid min-h-screen place-items-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
