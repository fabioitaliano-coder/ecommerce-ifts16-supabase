import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { dinero } from '../../lib/formato';
import type { DetallePedido as Detalle } from '../../types';

export function DetallePedido({ pedidoId }: { pedidoId: string }) {
  const [detalles, setDetalles] = useState<Detalle[] | null>(null);
  useEffect(() => {
    supabase.from('pedido_detalles').select('id, producto_nombre, cantidad, precio_unitario').eq('pedido_id', pedidoId)
      .then(({ data }) => setDetalles((data as Detalle[]) ?? []));
  }, [pedidoId]);

  if (!detalles) return <p>Cargando detalle…</p>;
  return (
    <ul className="detalle">
      {detalles.map((d) => <li key={d.id}>{d.cantidad} × {d.producto_nombre} — {dinero(d.precio_unitario)} c/u</li>)}
    </ul>
  );
}
