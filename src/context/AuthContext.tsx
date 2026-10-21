import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { invalidar } from '../lib/cache';
import type { Rol } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: Rol | null;
  rolListo: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Concepto · El rol recordado sirve SOLO para decidir qué pantalla mostrar sin esperar a la red.
// La seguridad real son las políticas RLS: aunque alguien edite este valor, la base rechaza todo lo que
// no le corresponde. Se revalida contra la base en cada inicio de sesión.
const CLAVE_ROL = 'rol-ifts16:';
const leerRolRecordado = (id: string): Rol | null => {
  try { const r = localStorage.getItem(CLAVE_ROL + id); return r === 'admin' || r === 'cliente' ? r : null; } catch { return null; }
};
const guardarRolRecordado = (id: string, r: Rol) => { try { localStorage.setItem(CLAVE_ROL + id, r); } catch { /* se ignora */ } };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Rol | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolListo, setRolListo] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion);
      if (!nuevaSesion) { setRole(null); setRolListo(false); setLoading(false); return; }
      // Concepto · Con la sesión ya se sabe quién es el usuario: la pantalla puede seguir.
      setLoading(false);
      const recordado = leerRolRecordado(nuevaSesion.user.id);
      setRole(recordado);
      setRolListo(Boolean(recordado));
      // Concepto · No hacer await de Supabase dentro de este callback (puede trabarse): se difiere con
      // setTimeout. El rol se lee de profiles y se revalida SIEMPRE: si cambió, se corrige enseguida.
      setTimeout(() => cargarRol(nuevaSesion.user.id), 0);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Si la consulta falla (red, límite de pedidos), se reintenta una vez. Nunca se asume 'cliente'
  // a ciegas: un admin con un error de red no debe quedar como cliente.
  const cargarRol = async (userId: string, intento = 1): Promise<void> => {
    const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
    if (error || !data) {
      if (intento < 2) { await new Promise((r) => setTimeout(r, 800)); return cargarRol(userId, intento + 1); }
      return; // sin dato fiable: se queda con el rol recordado (si había) o sin rol
    }
    guardarRolRecordado(userId, data.role as Rol);
    setRole(data.role as Rol);
    setRolListo(true);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    invalidar('admin:'); // los datos del panel son privados: no deben quedar en memoria al salir
  };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, role, rolListo, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return ctx;
}
