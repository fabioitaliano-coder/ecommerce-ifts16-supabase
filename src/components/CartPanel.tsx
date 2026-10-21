import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useDatosCacheados } from '../hooks/useDatosCacheados';
import { CLAVE_PROMOS, consultarPromos } from '../lib/catalogo';
import { invalidar } from '../lib/cache';
import { dinero } from '../lib/formato';
import { NotaClase } from './NotaClase';

type EstadoCodigo = '' | 'ok' | 'no-aplica' | 'login';

// El mismo panel se usa al costado de la tienda (pantallas anchas) y en la página /carrito.
export function CartPanel() {
  const { user } = useAuth();
  const { items, setCantidad, quitar, vaciar, subtotal, cantidadTotal, codigo, setCodigo } = useCart();
  const promos = useDatosCacheados(CLAVE_PROMOS, consultarPromos, true);
  const navigate = useNavigate();
  const [campo, setCampo] = useState(codigo ?? '');
  const [descuento, setDescuento] = useState(0);
  const [estado, setEstado] = useState<EstadoCodigo>('');
  const [aviso, setAviso] = useState<{ tipo: 'error' | 'info'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => setCampo(codigo ?? ''), [codigo]);

  // Vista previa del descuento (informativa). El importe definitivo lo calcula crear_pedido().
  useEffect(() => {
    if (!codigo) { setDescuento(0); setEstado(''); return; }
    const publica = promos.datos?.find((p) => p.codigo === codigo);
    if (user) {
      supabase.rpc('previsualizar_descuento', { p_subtotal: subtotal, p_codigo: codigo }).then(({ data }) => {
        const d = Number(data ?? 0); setDescuento(d); setEstado(d > 0 ? 'ok' : 'no-aplica');
      });
    } else if (publica) {
      const d = subtotal >= publica.monto_minimo ? Math.round(subtotal * publica.porcentaje) / 100 : 0;
      setDescuento(d); setEstado(d > 0 ? 'ok' : 'no-aplica');
    } else { setDescuento(0); setEstado('login'); }
  }, [codigo, subtotal, user, promos.datos]);

  const total = subtotal - descuento;

  const confirmar = async () => {
    if (enviando) return;
    if (!user) { navigate('/login', { state: { from: '/carrito' } }); return; }
    setEnviando(true);
    setAviso(null);
    // Concepto · Solo viajan producto_id y cantidad. Precios, stock y descuento los calcula
    // crear_pedido() en la base, dentro de una transacción.
    const { error } = await supabase.rpc('crear_pedido', {
      p_items: items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
      p_codigo: codigo,
    });
    if (error) {
      // P0002 = producto inexistente o fuera de vigencia (p. ej. un carrito guardado de antes de que cambie el catálogo).
      setAviso({ tipo: 'error', texto: error.code === 'P0002'
        ? 'Algún producto de tu carrito ya no está disponible. Quitalo o vaciá el carrito y volvé a elegir.'
        : error.message || 'No se pudo completar la compra.' });
    } else { vaciar(); invalidar('tienda:'); navigate('/mis-pedidos', { state: { creado: true } }); }
    setEnviando(false);
  };

  return (
    <section className="tarjeta panel-carrito" aria-label="Carrito de compras">
      <div className="encabezado-panel">
        <div>
          <h2>Carrito</h2>
          <p className="nota">Se guarda en <code>localStorage</code>.</p>
        </div>
        <button className="secundario chico peligro" onClick={vaciar} disabled={items.length === 0}>Vaciar</button>
      </div>

      <NotaClase titulo="checkout">
        Al confirmar viajan solo <code>producto_id</code> y <code>cantidad</code>. El precio, el stock y el descuento los calcula <code>crear_pedido()</code> en la base.
      </NotaClase>

      {items.length === 0 ? <p className="vacio">Todavía no hay productos en el carrito.</p> : (
        <ul className="lineas">
          {items.map((i) => (
            <li key={i.producto_id}>
              <div>
                <strong>{i.nombre}</strong>
                <span className="nota">{dinero(i.precio)} × {i.cantidad}</span>
                <div className="stepper" role="group" aria-label={`Cantidad de ${i.nombre}`}>
                  <button className="secundario chico" aria-label="Quitar uno" onClick={() => (i.cantidad > 1 ? setCantidad(i.producto_id, i.cantidad - 1) : quitar(i.producto_id))}>−</button>
                  <span aria-live="polite">{i.cantidad}</span>
                  <button className="secundario chico" aria-label="Agregar uno" disabled={i.cantidad >= i.stock} onClick={() => setCantidad(i.producto_id, i.cantidad + 1)}>+</button>
                </div>
              </div>
              <div className="derecha">
                <strong>{dinero(i.precio * i.cantidad)}</strong>
                <button className="enlace peligro" onClick={() => quitar(i.producto_id)}>Quitar</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="codigo" onSubmit={(e) => { e.preventDefault(); setCodigo(campo.trim().toUpperCase() || null); }}>
        <label>Código de descuento
          <span className="fila-codigo">
            <input value={campo} onChange={(e) => setCampo(e.target.value)} placeholder="Escribí un código" />
            <button type="submit" className="secundario">Aplicar</button>
          </span>
        </label>
      </form>
      {(promos.datos?.length ?? 0) > 0 && (
        <div className="promos" aria-label="Promociones disponibles">
          {promos.datos!.map((p) => (
            <button key={p.codigo} className={`promo${codigo === p.codigo ? ' aplicada' : ''}`} onClick={() => setCodigo(codigo === p.codigo ? null : p.codigo)}
              title={p.monto_minimo > 0 ? `Compra mínima ${dinero(p.monto_minimo)}` : 'Sin compra mínima'}>
              {codigo === p.codigo ? '✓ ' : ''}{p.codigo} · {Number(p.porcentaje)}% OFF
            </button>
          ))}
        </div>
      )}
      {estado === 'no-aplica' && <p className="aviso-codigo error">El código no aplica a este monto.</p>}
      {estado === 'login' && <p className="aviso-codigo">Iniciá sesión para validar este código.</p>}

      <dl className="totales">
        <dt>Ítems</dt><dd>{cantidadTotal}</dd>
        <dt>Subtotal</dt><dd>{dinero(subtotal)}</dd>
        {descuento > 0 && (<><dt>Descuento ({codigo})</dt><dd className="ok">− {dinero(descuento)}</dd></>)}
        <dt><strong>Total estimado</strong></dt><dd><strong>{dinero(total)}</strong></dd>
      </dl>
      <p className="nota">El total final lo calcula el servidor al confirmar.</p>

      {aviso && <p role="alert" className={`alerta ${aviso.tipo}`}>{aviso.texto}</p>}
      <button className="comprar-grande" onClick={confirmar} disabled={enviando || items.length === 0}>
        {enviando ? 'Procesando…' : user ? 'Confirmar compra' : 'Ingresar para comprar'}
      </button>
    </section>
  );
}
