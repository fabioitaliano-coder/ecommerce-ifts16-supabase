import { Fragment, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePaginado } from '../../hooks/usePaginado';
import { PaginationControls } from '../../components/PaginationControls';
import { DetallePedido } from '../cliente/DetallePedido';
import { dinero, fecha } from '../../lib/formato';
import { ESTADOS, type Estado, type Pedido, type ResumenEstado } from '../../types';

export function AdminPedidos() {
  const [filtro, setFiltro] = useState('');
  const [resumen, setResumen] = useState<ResumenEstado[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = usePaginado<Pedido>('pedidos', {
    select: '*, profiles(email, full_name)', orden: 'created_at', asc: false, filtros: { estado: filtro },
  });

  const cargarResumen = () =>
    supabase.from('resumen_pedidos_por_estado').select('*').then(({ data }) => setResumen((data as ResumenEstado[]) ?? []));
  useEffect(() => { cargarResumen(); }, []);

  const cambiarEstado = async (id: string, estado: Estado) => {
    setError(null);
    // Si un cliente intentara esto, la política pedidos_update_admin lo rechaza en la base.
    const { error } = await supabase.from('pedidos').update({ estado }).eq('id', id);
    if (error) setError('No se pudo cambiar el estado.');
    else { await t.recargar(); await cargarResumen(); }
  };

  return (
    <div>
      <ul className="resumen">
        {resumen.map((r) => <li key={r.estado}><strong>{r.cantidad}</strong> {r.estado}<small>{dinero(r.total)}</small></li>)}
      </ul>
      <label>Filtrar por estado{' '}
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todos</option>
          {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      {(error || t.error) && <p role="alert" className="error">{error ?? t.error}</p>}
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Fecha</th><th>Cliente</th><th>Total</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {t.filas.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td>{fecha(p.created_at)}</td>
                  <td>{p.profiles?.full_name ?? '—'}<br /><small>{p.profiles?.email}</small></td>
                  <td>{dinero(p.total)}</td>
                  <td>
                    <select aria-label="Estado del pedido" value={p.estado} onChange={(e) => cambiarEstado(p.id, e.target.value as Estado)}>
                      {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><button className="secundario" onClick={() => setAbierto(abierto === p.id ? null : p.id)}>{abierto === p.id ? 'Ocultar' : 'Detalle'}</button></td>
                </tr>
                {abierto === p.id && <tr><td colSpan={5}><DetallePedido pedidoId={p.id} /></td></tr>}
              </Fragment>
            ))}
            {!t.cargando && t.filas.length === 0 && <tr><td colSpan={5}>Sin pedidos.</td></tr>}
          </tbody>
        </table>
      </div>
      <PaginationControls currentPage={t.pagina} totalItems={t.total} pageSize={t.porPagina} onPageChange={t.setPagina} />
    </div>
  );
}
