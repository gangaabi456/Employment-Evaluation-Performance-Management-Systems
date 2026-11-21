import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken } from "./api.js";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener("auth-expired", expire);
    if (getToken()) api("/auth/me/").then(setUser).catch(() => {}).finally(() => setReady(true));
    else setReady(true);
    return () => window.removeEventListener("auth-expired", expire);
  }, []);

  const login = async (username, password) => {
    const r = await api("/auth/login/", { method: "POST", body: { username, password } });
    localStorage.setItem("token", r.token);
    setUser(r.user);
    return r.user;
  };
  const logout = async () => {
    try { await api("/auth/logout/", { method: "POST" }); } catch {}
    localStorage.removeItem("token");
    setUser(null);
  };
  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}
