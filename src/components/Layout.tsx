import { Suspense } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useModoClase } from '../context/ModoClaseContext';

export function Layout() {
  const { user, role, signOut } = useAuth();
  const { cantidadTotal } = useCart();
  const clase = useModoClase();
  return (
    <>
      <header className="barra">
        <Link to="/" className="marca">E-commerce IFTS 16</Link>
        <nav aria-label="Principal">
          <NavLink to="/" end>Tienda</NavLink>
          <NavLink to="/carrito">Carrito{cantidadTotal > 0 && <span className="insignia">{cantidadTotal}</span>}</NavLink>
          {user && <NavLink to="/mis-pedidos">Mis pedidos</NavLink>}
          {role === 'admin' && <NavLink to="/admin">Administración</NavLink>}
        </nav>
        <div className="sesion">
          <label className="interruptor" title="Muestra u oculta las notas que explican qué hace cada pantalla">
            <input type="checkbox" role="switch" aria-label="Notas explicativas" checked={clase.activo} onChange={clase.alternar} />
            <span className="pista" aria-hidden="true"><span className="perilla" /></span>
            <span className="texto-interruptor">Notas explicativas</span>
          </label>
          {user ? (
            <>
              <small>{user.email}{role ? ` · ${role}` : ''}</small>
              <button className="secundario" onClick={signOut}>Salir</button>
            </>
          ) : (
            <Link to="/login" className="boton secundario">Ingresar</Link>
          )}
        </div>
      </header>
      <main><Suspense fallback={<p className="centro">Cargando…</p>}><Outlet /></Suspense></main>
    </>
  );
}
