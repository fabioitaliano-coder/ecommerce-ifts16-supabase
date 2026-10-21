import { useEffect, useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useDebounce } from '../../hooks/useDebounce';
import { useDatosCacheados } from '../../hooks/useDatosCacheados';
import { PaginationControls } from '../../components/PaginationControls';
import { precargar } from '../../lib/cache';
import {
  CLAVE_CATEGORIAS, POR_PAGINA, claveProductos, consultarCategorias, consultarProductos,
  precargarCategoria, precargarTodasLasCategorias, type FiltroTienda,
} from '../../lib/catalogo';
import { dinero } from '../../lib/formato';
import { urlImagen } from '../../lib/imagenes';

export function Tienda() {
  const { items, agregar } = useCart();
  const [categoria, setCategoria] = useState('');
  const [texto, setTexto] = useState('');
  const [pagina, setPagina] = useState(1);
  const busqueda = useDebounce(texto);

  const filtro: FiltroTienda = { categoria, busqueda, pagina };
  const cats = useDatosCacheados(CLAVE_CATEGORIAS, consultarCategorias, true);
  // La búsqueda por texto no se guarda en localStorage (hay infinitas combinaciones).
  const prod = useDatosCacheados(claveProductos(filtro), () => consultarProductos(filtro), !busqueda);

  const filas = prod.datos?.filas ?? [];
  const total = prod.datos?.total ?? 0;

  // Con las categorías a mano, se precarga la primera página de cada una cuando el navegador está libre.
  useEffect(() => {
    if (!cats.datos) return;
    const id = precargarTodasLasCategorias(cats.datos);
    return () => { if ('cancelIdleCallback' in window && typeof id === 'number') window.cancelIdleCallback(id); };
  }, [cats.datos]);

  // Y se precarga la página siguiente de lo que se está mirando.
  useEffect(() => {
    if (!prod.datos || pagina * POR_PAGINA >= total) return;
    const siguiente = { ...filtro, pagina: pagina + 1 };
    precargar(claveProductos(siguiente), () => consultarProductos(siguiente), !busqueda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prod.datos]);

  const elegirCategoria = (id: string) => { setCategoria(id); setPagina(1); };

  return (
    <section>
      <h1>Productos</h1>
      <div className="fila">
        <label>Buscar <input type="search" value={texto} onChange={(e) => { setTexto(e.target.value); setPagina(1); }} placeholder="Nombre del producto" /></label>
      </div>
      <div className="pildoras" role="group" aria-label="Filtrar por categoría">
        <button className={`pildora${categoria === '' ? ' activa' : ''}`} aria-pressed={categoria === ''} onClick={() => elegirCategoria('')}>Todas</button>
        {(cats.datos ?? []).map((c) => {
          const id = String(c.id);
          return (
            <button key={c.id} className={`pildora${categoria === id ? ' activa' : ''}`} aria-pressed={categoria === id}
              onPointerEnter={() => precargarCategoria(id)} onFocus={() => precargarCategoria(id)}
              onClick={() => elegirCategoria(id)}>{c.nombre}</button>
          );
        })}
      </div>

      {prod.error && <p role="alert" className="error">No se pudieron cargar los productos. Probá de nuevo en unos segundos.</p>}
      {!prod.cargando && !prod.error && filas.length === 0 && <p>No hay productos para mostrar.</p>}

      <div className="grilla">
        {prod.cargando && Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="tarjeta producto esqueleto" aria-hidden="true">
            <div className="foto bloque" /><div className="bloque corto" /><div className="bloque" /><div className="bloque" /><div className="bloque boton" />
          </div>
        ))}
        {filas.map((p, i) => {
          const enCarrito = items.find((it) => it.producto_id === p.id)?.cantidad ?? 0;
          const agotado = p.stock <= 0;
          const maximo = !agotado && enCarrito >= p.stock;
          const url = urlImagen(p.imagen_path);
          return (
            <article key={p.id} className="tarjeta producto">
              <div className="marco">
                {url
                  ? <img className="foto" src={url} alt={p.nombre} width={640} height={480}
                      loading={i < 4 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'auto'} decoding="async" />
                  : <div className="foto vacia" aria-hidden="true">Sin imagen</div>}
                {enCarrito > 0 && <span className="en-carrito">{enCarrito} en carrito</span>}
              </div>
              <span className="etiqueta">{p.categorias?.nombre}</span>
              <h2>{p.nombre}</h2>
              <p className="descripcion">{p.descripcion}</p>
              <p className="precio">{dinero(p.precio)}</p>
              <p className={`linea-stock ${agotado ? 'error' : 'stock'}`}>
                {agotado ? 'Sin stock' : p.stock <= 5 ? `¡Últimas ${p.stock} unidades!` : `${p.stock} disponibles`}
              </p>
              {/* El texto del botón no cambia con la cantidad: esa información va en la etiqueta de la foto. */}
              <button className="comprar" onClick={() => agregar(p)} disabled={agotado || maximo}>
                {agotado ? 'Sin stock' : maximo ? 'Máximo en carrito' : 'Agregar al carrito'}
              </button>
            </article>
          );
        })}
      </div>
      <PaginationControls currentPage={pagina} totalItems={total} pageSize={POR_PAGINA} onPageChange={setPagina} />
    </section>
  );
}
