import { createContext, useContext, useState, useEffect } from 'react';
import { api, store, setOnLogout } from './api';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { const a = store.get(); return a?.access ? { rol: a.rol, nombre: a.nombre } : null; });
  useEffect(() => { setOnLogout(() => setUser(null)); }, []);
  const login = async (username, password) => {
    const d = await api('/auth/login/', { method: 'POST', body: { username, password }, auth: false });
    store.set(d); setUser({ rol: d.rol, nombre: d.nombre });
  };
  const logout = async () => {
    const a = store.get();
    try { if (a?.refresh) await api('/auth/logout/', { method: 'POST', body: { refresh: a.refresh } }); } catch {}
    store.clear(); setUser(null);
  };
  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}
