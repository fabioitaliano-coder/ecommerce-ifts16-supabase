import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { usePaginado } from '../../hooks/usePaginado';
import { PaginationControls } from '../../components/PaginationControls';
import { dinero } from '../../lib/formato';
import type { Descuento } from '../../types';

export function AdminDescuentos() {
  const [form, setForm] = useState<{ id?: number; codigo: string; porcentaje: string; monto_minimo: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = usePaginado<Descuento>('descuentos', { orden: 'codigo' });

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError(null);
    const datos = { codigo: form.codigo.trim().toUpperCase(), porcentaje: Number(form.porcentaje), monto_minimo: Number(form.monto_minimo || 0) };
    const { error } = form.id
      ? await supabase.from('descuentos').update(datos).eq('id', form.id)
      : await supabase.from('descuentos').insert(datos);
    if (error) setError(error.code === '23505' ? 'Ya existe ese código.' : `No se pudo guardar: ${error.message}`);
    else { setForm(null); await t.recargar(); }
  };

  const borrar = async (d: Descuento) => {
    if (!confirm(`¿Borrar el código ${d.codigo}?`)) return;
    const { error } = await supabase.from('descuentos').delete().eq('id', d.id);
    if (error) setError('No se pudo borrar.'); else await t.recargar();
  };

  return (
    <div>
      <div className="fila"><button onClick={() => setForm({ codigo: '', porcentaje: '', monto_minimo: '0' })}>Nuevo código</button></div>
      {form && (
        <form className="tarjeta formulario ancho" onSubmit={guardar}>
          <h2>{form.id ? 'Editar descuento' : 'Nuevo descuento'}</h2>
          <label>Código <input required value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} /></label>
          <label>Porcentaje (1–100) <input type="number" required min="1" max="100" step="0.01" value={form.porcentaje} onChange={(e) => setForm({ ...form, porcentaje: e.target.value })} /></label>
          <label>Monto mínimo <input type="number" min="0" step="0.01" value={form.monto_minimo} onChange={(e) => setForm({ ...form, monto_minimo: e.target.value })} /></label>
          <div className="fila">
            <button type="submit">Guardar</button>
            <button type="button" className="secundario" onClick={() => { setForm(null); setError(null); }}>Cancelar</button>
          </div>
        </form>
      )}
      {(error || t.error) && <p role="alert" className="error">{error ?? t.error}</p>}
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Código</th><th>Porcentaje</th><th>Monto mínimo</th><th></th></tr></thead>
          <tbody>
            {t.filas.map((d) => (
              <tr key={d.id}>
                <td><code>{d.codigo}</code></td><td>{d.porcentaje}%</td><td>{dinero(d.monto_minimo)}</td>
                <td className="acciones">
                  <button className="secundario" onClick={() => setForm({ id: d.id, codigo: d.codigo, porcentaje: String(d.porcentaje), monto_minimo: String(d.monto_minimo) })}>Editar</button>
                  <button className="secundario peligro" onClick={() => borrar(d)}>Borrar</button>
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
