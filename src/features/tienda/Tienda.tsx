import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/CartContext';
import { useDebounce } from '../../hooks/useDebounce';
import { usePaginado } from '../../hooks/usePaginado';
import { PaginationControls } from '../../components/PaginationControls';
import { dinero } from '../../lib/formato';
import type { Categoria, Producto } from '../../types';

export function Tienda() {
  const { items, agregar } = useCart();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoria, setCategoria] = useState('');
  const [texto, setTexto] = useState('');
  const busqueda = useDebounce(texto);

  useEffect(() => {
    // Catálogo público: RLS permite leer categorías sin sesión.
    supabase.from('categorias').select('*').order('nombre').then(({ data }) => setCategorias((data as Categoria[]) ?? []));
  }, []);

  const { filas, total, pagina, setPagina, porPagina, cargando, error } = usePaginado<Producto>('productos', {
    select: '*, categorias(nombre)',
    orden: 'nombre',
    porPagina: 12,
    soloVigentes: true,
    filtros: { categoria_id: categoria },
    busqueda: { columna: 'nombre', texto: busqueda },
  });

  return (
    <section>
      <h1>Productos</h1>
      <div className="fila">
        <label>Buscar <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre del producto" /></label>
        <label>Categoría
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      {!cargando && filas.length === 0 && <p>No hay productos para mostrar.</p>}
      <div className="grilla">
        {filas.map((p) => {
          const enCarrito = items.find((i) => i.producto_id === p.id)?.cantidad ?? 0;
          const agotado = p.stock <= 0;
          return (
            <article key={p.id} className="tarjeta producto">
              <small>{p.categorias?.nombre}</small>
              <h2>{p.nombre}</h2>
              <p className="precio">{dinero(p.precio)}</p>
              <p className={agotado ? 'error' : 'stock'}>{agotado ? 'Sin stock' : p.stock <= 5 ? `¡Últimas ${p.stock} unidades!` : `${p.stock} disponibles`}</p>
              <button onClick={() => agregar(p)} disabled={agotado || enCarrito >= p.stock}>
                {enCarrito > 0 ? `Agregar otro (${enCarrito} en carrito)` : 'Agregar al carrito'}
              </button>
            </article>
          );
        })}
      </div>
      <PaginationControls currentPage={pagina} totalItems={total} pageSize={porPagina} onPageChange={setPagina} />
    </section>
  );
}
