import { NavLink, Outlet } from 'react-router-dom';

export function AdminLayout() {
  return (
    <section>
      <h1>Administración</h1>
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
