import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { invalidar } from '../../lib/cache';
import { usePaginado } from '../../hooks/usePaginado';
import { PaginationControls } from '../../components/PaginationControls';
import type { Categoria } from '../../types';

export function AdminCategorias() {
  const [form, setForm] = useState<{ id?: number; nombre: string; descripcion: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = usePaginado<Categoria>('categorias', { orden: 'nombre' });

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError(null);
    const datos = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null };
    const { error } = form.id
      ? await supabase.from('categorias').update(datos).eq('id', form.id)
      : await supabase.from('categorias').insert(datos);
    if (error) setError(error.code === '23505' ? 'Ya existe una categoría con ese nombre.' : `No se pudo guardar: ${error.message}`);
    else { setForm(null); invalidar('tienda:');
    await t.recargar(); }
  };

  const borrar = async (c: Categoria) => {
    if (!confirm(`¿Borrar la categoría "${c.nombre}"?`)) return;
    const { error } = await supabase.from('categorias').delete().eq('id', c.id);
    // 23503 = foreign_key_violation: la categoría todavía tiene productos (ON DELETE RESTRICT).
    if (error) setError(error.code === '23503' ? 'No se puede borrar: tiene productos asociados.' : 'No se pudo borrar.');
    else { setError(null); invalidar('tienda:');
    await t.recargar(); }
  };

  return (
    <div>
      <div className="fila"><button onClick={() => setForm({ nombre: '', descripcion: '' })}>Nueva categoría</button></div>
      {form && (
        <form className="tarjeta formulario ancho" onSubmit={guardar}>
          <h2>{form.id ? 'Editar categoría' : 'Nueva categoría'}</h2>
          <label>Nombre <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label>
          <label>Descripción <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></label>
          <div className="fila">
            <button type="submit">Guardar</button>
            <button type="button" className="secundario" onClick={() => { setForm(null); setError(null); }}>Cancelar</button>
          </div>
        </form>
      )}
      {(error || t.error) && <p role="alert" className="error">{error ?? t.error}</p>}
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Nombre</th><th>Descripción</th><th></th></tr></thead>
          <tbody>
            {t.filas.map((c) => (
              <tr key={c.id}>
                <td>{c.nombre}</td><td>{c.descripcion}</td>
                <td className="acciones">
                  <button className="secundario" onClick={() => setForm({ id: c.id, nombre: c.nombre, descripcion: c.descripcion ?? '' })}>Editar</button>
                  <button className="secundario peligro" onClick={() => borrar(c)}>Borrar</button>
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
