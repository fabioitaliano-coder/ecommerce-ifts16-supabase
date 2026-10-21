import { Fragment, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePaginado } from '../../hooks/usePaginado';
import { PaginationControls } from '../../components/PaginationControls';
import { DetallePedido } from './DetallePedido';
import { dinero, fecha } from '../../lib/formato';
import type { Pedido } from '../../types';

export function MisPedidos() {
  const { user } = useAuth();
  const creado = (useLocation().state as { creado?: boolean } | null)?.creado;
  const [abierto, setAbierto] = useState<string | null>(null);
  // El filtro por user_id es redundante con RLS a propósito: dos capas de seguridad.
  const { filas, total, pagina, setPagina, porPagina, cargando, error } = usePaginado<Pedido>('pedidos', {
    orden: 'created_at', asc: false, filtros: { user_id: user?.id },
  });

  return (
    <section>
      <h1>Mis pedidos</h1>
      {creado && <p role="status" className="exito">¡Compra realizada! Tu pedido quedó registrado.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Fecha</th><th>Subtotal</th><th>Descuento</th><th>Total</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {filas.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td>{fecha(p.created_at)}</td>
                  <td>{dinero(p.subtotal)}</td>
                  <td>{Number(p.descuento) > 0 ? `${dinero(p.descuento)} (${p.codigo_descuento})` : '—'}</td>
                  <td><strong>{dinero(p.total)}</strong></td>
                  <td><span className={`estado ${p.estado}`}>{p.estado}</span></td>
                  <td><button className="secundario" onClick={() => setAbierto(abierto === p.id ? null : p.id)}>{abierto === p.id ? 'Ocultar' : 'Detalle'}</button></td>
                </tr>
                {abierto === p.id && <tr><td colSpan={6}><DetallePedido pedidoId={p.id} /></td></tr>}
              </Fragment>
            ))}
            {!cargando && filas.length === 0 && <tr><td colSpan={6}>Todavía no tenés pedidos.</td></tr>}
          </tbody>
        </table>
      </div>
      <PaginationControls currentPage={pagina} totalItems={total} pageSize={porPagina} onPageChange={setPagina} />
    </section>
  );
}
