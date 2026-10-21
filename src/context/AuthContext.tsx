import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
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
      // El rol llega un instante después y solo lo esperan las rutas que lo necesitan (admin).
      setLoading(false);
      setRolListo(false);
      // Concepto · No hacer await de Supabase dentro de este callback (puede trabarse):
      // se difiere con setTimeout y el rol se lee de profiles (protegida por RLS).
      setTimeout(async () => {
        const { data } = await supabase.from('profiles').select('role').eq('id', nuevaSesion.user.id).single();
        setRole((data?.role as Rol) ?? 'cliente');
        setRolListo(true);
      }, 0);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };

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
