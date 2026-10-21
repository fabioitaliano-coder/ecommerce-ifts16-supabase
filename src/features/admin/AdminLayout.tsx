import { NavLink, Outlet } from 'react-router-dom';
import { NotaClase } from '../../components/NotaClase';

export function AdminLayout() {
  return (
    <section>
      <h1>Administración</h1>
      <NotaClase titulo="administración">
        Cada pestaña consulta con la <strong>sesión del admin</strong>. Si un cliente intentara las mismas operaciones con la API, las políticas RLS las rechazarían en la base: la pantalla es solo comodidad.
      </NotaClase>
      <nav className="pestanas" aria-label="Secciones de administración">
        <NavLink to="/admin/pedidos">Pedidos</NavLink>
        <NavLink to="/admin/productos">Productos</NavLink>
        <NavLink to="/admin/categorias">Categorías</NavLink>
        <NavLink to="/admin/descuentos">Descuentos</NavLink>
        <NavLink to="/admin/clientes">Clientes</NavLink>
      </nav>
      <Outlet />
    </section>
  );
}
