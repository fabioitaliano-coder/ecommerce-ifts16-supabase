import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { usePaginado } from '../../hooks/usePaginado';
import { PaginationControls } from '../../components/PaginationControls';
import { dinero, hoy } from '../../lib/formato';
import { borrarImagen, subirImagen, urlImagen, validarImagen } from '../../lib/imagenes';
import type { Categoria, Producto } from '../../types';

const VACIO = { id: 0, nombre: '', descripcion: '', precio: '', stock: '', categoria_id: '', vigente_desde: '2000-01-01', vigente_hasta: '2099-12-31', imagen_path: '' };

export function AdminProductos() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [form, setForm] = useState<typeof VACIO | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const t = usePaginado<Producto>('productos', { select: '*, categorias(nombre)', orden: 'nombre' });

  useEffect(() => {
    supabase.from('categorias').select('*').order('nombre').then(({ data }) => setCategorias((data as Categoria[]) ?? []));
  }, []);

  // La vista previa usa una URL temporal del navegador; se libera al cambiar o desmontar.
  useEffect(() => {
    if (!archivo) { setVistaPrevia(null); return; }
    const url = URL.createObjectURL(archivo);
    setVistaPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const abrir = (f: typeof VACIO) => { setForm(f); setArchivo(null); setError(null); };
  const cerrar = () => { setForm(null); setArchivo(null); setError(null); };

  const editar = (p: Producto) => abrir({
    id: p.id, nombre: p.nombre, descripcion: p.descripcion ?? '', precio: String(p.precio), stock: String(p.stock), categoria_id: String(p.categoria_id),
    vigente_desde: p.vigente_desde, vigente_hasta: p.vigente_hasta, imagen_path: p.imagen_path ?? '',
  });

  const elegirArchivo = (f: File | null) => {
    if (f) { const problema = validarImagen(f); if (problema) { setError(problema); return; } }
    setError(null);
    setArchivo(f);
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || enviando) return;
    setEnviando(true);
    setError(null);
    let nuevaRuta: string | null = null;
    try {
      // 1) Primero se sube la imagen nueva (si hay); recién después se guarda la fila.
      if (archivo) nuevaRuta = await subirImagen(archivo);
      const datos = {
        nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null, precio: Number(form.precio), stock: Number(form.stock),
        categoria_id: Number(form.categoria_id), vigente_desde: form.vigente_desde, vigente_hasta: form.vigente_hasta,
        imagen_path: nuevaRuta ?? (form.imagen_path || null),
      };
      const { error } = form.id
        ? await supabase.from('productos').update(datos).eq('id', form.id)
        : await supabase.from('productos').insert(datos);
      if (error) throw error;
      // 2) Si se reemplazó la imagen, se borra la anterior para no dejar archivos huérfanos.
      if (nuevaRuta && form.imagen_path) await borrarImagen(form.imagen_path);
      cerrar();
      await t.recargar();
    } catch (err) {
      // Si falló el guardado de la fila, se deshace la subida para no dejar un archivo suelto.
      if (nuevaRuta) await borrarImagen(nuevaRuta);
      setError(`No se pudo guardar: ${(err as { message?: string }).message ?? 'error desconocido'}`);
    }
    setEnviando(false);
  };

  const borrar = async (p: Producto) => {
    if (!confirm(`¿Borrar "${p.nombre}"? El historial de pedidos se conserva.`)) return;
    const { error } = await supabase.from('productos').delete().eq('id', p.id);
    if (error) { setError('No se pudo borrar el producto.'); return; }
    await borrarImagen(p.imagen_path);
    await t.recargar();
  };

  const campo = (k: keyof typeof VACIO) => ({
    value: form?.[k] ?? '',
    onChange: (e: { target: { value: string } }) => setForm({ ...form!, [k]: e.target.value }),
  });
  const imagenActual = vistaPrevia ?? urlImagen(form?.imagen_path);

  return (
    <div>
      <div className="fila"><button onClick={() => abrir(VACIO)} disabled={categorias.length === 0}>Nuevo producto</button></div>
      {form && (
        <form className="tarjeta formulario ancho" onSubmit={guardar}>
          <h2>{form.id ? 'Editar producto' : 'Nuevo producto'}</h2>
          <label>Nombre <input required {...campo('nombre')} /></label>
          <label>Descripción <input maxLength={200} {...campo('descripcion')} /></label>
          <label>Precio <input type="number" min="0" step="0.01" required {...campo('precio')} /></label>
          <label>Stock <input type="number" min="0" step="1" required {...campo('stock')} /></label>
          <label>Categoría
            <select required {...campo('categoria_id')}>
              <option value="">Elegí una</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label>Vigente desde <input type="date" required {...campo('vigente_desde')} /></label>
          <label>Vigente hasta <input type="date" required {...campo('vigente_hasta')} /></label>
          <label>Imagen (JPG, PNG o WebP, hasta 2 MB)
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)} />
          </label>
          {imagenActual && <img className="foto vista-previa" src={imagenActual} alt="Vista previa de la imagen del producto" />}
          {error && <p role="alert" className="error">{error}</p>}
          <div className="fila">
            <button type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</button>
            <button type="button" className="secundario" onClick={cerrar}>Cancelar</button>
          </div>
        </form>
      )}
      {!form && (error || t.error) && <p role="alert" className="error">{error ?? t.error}</p>}
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Imagen</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Vigencia</th><th></th></tr></thead>
          <tbody>
            {t.filas.map((p) => (
              <tr key={p.id}>
                <td>{urlImagen(p.imagen_path) ? <img className="miniatura" src={urlImagen(p.imagen_path)!} alt="" loading="lazy" /> : '—'}</td>
                <td>{p.nombre}</td><td>{p.categorias?.nombre}</td><td>{dinero(p.precio)}</td><td>{p.stock}</td>
                <td>{p.vigente_hasta < hoy() ? <span className="estado cancelado">vencido</span> : `${p.vigente_desde} → ${p.vigente_hasta}`}</td>
                <td className="acciones">
                  <button className="secundario" onClick={() => editar(p)}>Editar</button>
                  <button className="secundario peligro" onClick={() => borrar(p)}>Borrar</button>
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
