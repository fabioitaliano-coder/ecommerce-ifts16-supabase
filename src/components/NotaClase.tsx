import type { ReactNode } from 'react';
import { useModoClase } from '../context/ModoClaseContext';

export function NotaClase({ titulo, children }: { titulo: string; children: ReactNode }) {
  const { activo } = useModoClase();
  if (!activo) return null;
  // En pantallas chicas la nota arranca plegada para no ocupar media pantalla.
  const chica = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
  return (
    <details className="nota-clase" open={!chica}>
      <summary>Nota · {titulo}</summary>
      <div>{children}</div>
    </details>
  );
}
