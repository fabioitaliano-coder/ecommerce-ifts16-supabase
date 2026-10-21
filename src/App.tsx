import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginForm } from './features/auth/LoginForm';
import { RegisterForm } from './features/auth/RegisterForm';
import { Tienda } from './features/tienda/Tienda';
import { Carrito } from './features/tienda/Carrito';
import { MisPedidos } from './features/cliente/MisPedidos';
import { AdminLayout } from './features/admin/AdminLayout';
import { AdminPedidos } from './features/admin/AdminPedidos';
import { AdminProductos } from './features/admin/AdminProductos';
import { AdminCategorias } from './features/admin/AdminCategorias';
import { AdminDescuentos } from './features/admin/AdminDescuentos';
import { AdminClientes } from './features/admin/AdminClientes';

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              {/* Públicas: el catálogo se ve sin sesión */}
              <Route path="/" element={<Tienda />} />
              <Route path="/carrito" element={<Carrito />} />
              <Route path="/login" element={<LoginForm />} />
              <Route path="/registro" element={<RegisterForm />} />
              <Route path="/unauthorized" element={<p className="centro">No tenés permiso para ver esta página.</p>} />
              {/* Requieren sesión */}
              <Route element={<ProtectedRoute />}>
                <Route path="/mis-pedidos" element={<MisPedidos />} />
              </Route>
              {/* Solo admin (la barrera real es RLS; esto es la capa de navegación) */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="pedidos" replace />} />
                  <Route path="pedidos" element={<AdminPedidos />} />
                  <Route path="productos" element={<AdminProductos />} />
                  <Route path="categorias" element={<AdminCategorias />} />
                  <Route path="descuentos" element={<AdminDescuentos />} />
                  <Route path="clientes" element={<AdminClientes />} />
                </Route>
              </Route>
              <Route path="*" element={<p className="centro">Página no encontrada.</p>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
