import type { ReactNode } from 'react';
import { useModoClase } from '../context/ModoClaseContext';

export function NotaClase({ titulo, children }: { titulo: string; children: ReactNode }) {
  const { activo } = useModoClase();
  if (!activo) return null;
  return (
    <aside className="nota-clase" aria-label={`Nota explicativa: ${titulo}`}>
      <strong>Nota · {titulo}</strong>
      <div>{children}</div>
    </aside>
  );
}
