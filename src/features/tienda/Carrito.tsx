import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { dinero } from '../../lib/formato';

export function Carrito() {
  const { user } = useAuth();
  const { items, setCantidad, quitar, vaciar, subtotal } = useCart();
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState('');
  const [aplicado, setAplicado] = useState<string | null>(null);
  const [descuento, setDescuento] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Vista previa del descuento: lo calcula la base (previsualizar_descuento). No escribe nada.
  useEffect(() => {
    if (!aplicado || !user) { setDescuento(0); return; }
    supabase.rpc('previsualizar_descuento', { p_subtotal: subtotal, p_codigo: aplicado })
      .then(({ data }) => setDescuento(Number(data ?? 0)));
  }, [aplicado, subtotal, user]);

  const total = subtotal - descuento;

  const confirmar = async () => {
    if (enviando) return;
    if (!user) { navigate('/login', { state: { from: '/carrito' } }); return; }
    setEnviando(true);
    setError(null);
    // Concepto · Solo viajan producto_id y cantidad. Precios, stock y descuento los
    // calcula crear_pedido() en la base, dentro de una transacción.
    const { error } = await supabase.rpc('crear_pedido', {
      p_items: items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
      p_codigo: aplicado,
    });
    // P0002 = producto inexistente o fuera de vigencia (p. ej. un carrito guardado de antes de que cambie el catálogo).
    if (error) setError(error.code === 'P0002'
      ? 'Algún producto de tu carrito ya no está disponible. Quitalo o vaciá el carrito y volvé a elegir.'
      : error.message || 'No se pudo completar la compra.');
    else { vaciar(); navigate('/mis-pedidos', { state: { creado: true } }); }
    setEnviando(false);
  };

  if (items.length === 0) return <section><h1>Carrito</h1><p>Tu carrito está vacío. <Link to="/">Ver productos</Link></p></section>;

  return (
    <section>
      <h1>Carrito</h1>
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Producto</th><th>Precio</th><th>Cantidad</th><th>Subtotal</th><th></th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.producto_id}>
                <td>{i.nombre}</td>
                <td>{dinero(i.precio)}</td>
                <td><input type="number" min={1} max={i.stock} value={i.cantidad} aria-label={`Cantidad de ${i.nombre}`}
                  onChange={(e) => setCantidad(i.producto_id, Number(e.target.value))} className="cantidad" /></td>
                <td>{dinero(i.precio * i.cantidad)}</td>
                <td><button className="secundario" onClick={() => quitar(i.producto_id)}>Quitar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="fila" onSubmit={(e) => { e.preventDefault(); setAplicado(codigo.trim().toUpperCase() || null); }}>
        <label>Código de descuento <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="BIENVENIDA10" /></label>
        <button type="submit" className="secundario">Aplicar</button>
      </form>
      {aplicado && !user && <p>Iniciá sesión para aplicar el código.</p>}
      {aplicado && user && descuento === 0 && <p className="error">El código no aplica a este monto.</p>}

      <dl className="totales">
        <dt>Subtotal</dt><dd>{dinero(subtotal)}</dd>
        {descuento > 0 && (<><dt>Descuento ({aplicado})</dt><dd>− {dinero(descuento)}</dd></>)}
        <dt><strong>Total estimado</strong></dt><dd><strong>{dinero(total)}</strong></dd>
      </dl>
      <p><small>El total final lo calcula el servidor con los precios y el stock reales al confirmar.</small></p>

      {error && <p role="alert" className="error">{error}</p>}
      <div className="fila">
        <button onClick={confirmar} disabled={enviando}>{enviando ? 'Procesando…' : user ? 'Confirmar compra' : 'Ingresar para comprar'}</button>
        <button className="secundario" onClick={vaciar}>Vaciar carrito</button>
      </div>
    </section>
  );
}
