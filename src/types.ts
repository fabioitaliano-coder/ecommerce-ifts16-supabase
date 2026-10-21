export type Rol = 'cliente' | 'admin';
export type Estado = 'pendiente' | 'confirmado' | 'entregado' | 'cancelado';
export const ESTADOS: Estado[] = ['pendiente', 'confirmado', 'entregado', 'cancelado'];

export interface Categoria { id: number; nombre: string; descripcion: string | null }

export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  stock: number;
  categoria_id: number;
  vigente_desde: string;
  vigente_hasta: string;
  imagen_path: string | null;
  categorias?: { nombre: string } | null;
}

export interface Descuento { id: number; codigo: string; porcentaje: number; monto_minimo: number }

export interface Perfil { id: string; email: string | null; full_name: string; role: Rol; created_at: string }

export interface Pedido {
  id: string;
  user_id: string;
  subtotal: number;
  descuento: number;
  total: number;
  codigo_descuento: string | null;
  estado: Estado;
  created_at: string;
  profiles?: { email: string | null; full_name: string } | null;
}

export interface DetallePedido {
  id: string;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
}

export interface ResumenEstado { estado: Estado; cantidad: number; total: number }
