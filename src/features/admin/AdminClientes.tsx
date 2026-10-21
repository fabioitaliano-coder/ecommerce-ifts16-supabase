import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { usePaginado } from '../../hooks/usePaginado';
import { PaginationControls } from '../../components/PaginationControls';
import { fecha } from '../../lib/formato';
import type { Perfil, Rol } from '../../types';

export function AdminClientes() {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const t = usePaginado<Perfil>('profiles', { orden: 'created_at', asc: false });

  // Promover o degradar un usuario: solo el admin puede (política profiles_update_admin).
  const cambiarRol = async (p: Perfil, role: Rol) => {
    if (!confirm(`¿Cambiar el rol de ${p.email} a "${role}"?`)) return;
    const { error } = await supabase.from('profiles').update({ role }).eq('id', p.id);
    if (error) setError('No se pudo cambiar el rol.'); else { setError(null); await t.recargar(); }
  };

  return (
    <div>
      {(error || t.error) && <p role="alert" className="error">{error ?? t.error}</p>}
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Nombre</th><th>Email</th><th>Alta</th><th>Rol</th></tr></thead>
          <tbody>
            {t.filas.map((p) => (
              <tr key={p.id}>
                <td>{p.full_name}</td><td>{p.email}</td><td>{fecha(p.created_at)}</td>
                <td>
                  <select aria-label={`Rol de ${p.email}`} value={p.role} disabled={p.id === user?.id}
                    title={p.id === user?.id ? 'No podés cambiar tu propio rol' : undefined}
                    onChange={(e) => cambiarRol(p, e.target.value as Rol)}>
                    <option value="cliente">cliente</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls currentPage={t.pagina} totalItems={t.total} pageSize={t.porPagina} onPageChange={t.setPagina} />
    </div>
  );
}
