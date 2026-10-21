import { createContext, useContext, useState, type ReactNode } from 'react';

// Concepto · "Modo clase": muestra notas que explican qué hace cada pantalla (qué consulta,
// qué política RLS interviene). Es material pedagógico y se puede ocultar.
interface ModoClase { activo: boolean; alternar: () => void }
const Ctx = createContext<ModoClase>({ activo: true, alternar: () => {} });
const CLAVE = 'modo-clase-ifts16';

export function ModoClaseProvider({ children }: { children: ReactNode }) {
  const [activo, setActivo] = useState(() => { try { return localStorage.getItem(CLAVE) !== 'no'; } catch { return true; } });
  const alternar = () => setActivo((a) => {
    try { localStorage.setItem(CLAVE, a ? 'no' : 'si'); } catch { /* se ignora */ }
    return !a;
  });
  return <Ctx.Provider value={{ activo, alternar }}>{children}</Ctx.Provider>;
}

export const useModoClase = () => useContext(Ctx);
