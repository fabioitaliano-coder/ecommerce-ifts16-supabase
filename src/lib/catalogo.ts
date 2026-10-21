import { supabasePublico } from './supabase';
import { cuandoEsteLibre, precargar } from './cache';
import { hoy } from './formato';
import type { Categoria, Producto } from '../types';

export const POR_PAGINA = 12;
export const CLAVE_CATEGORIAS = 'tienda:categorias';

export interface FiltroTienda { categoria: string; busqueda: string; pagina: number }
export interface PaginaProductos { filas: Producto[]; total: number }

export const claveProductos = (f: FiltroTienda) =>
  `tienda:productos:${f.categoria || 'todas'}:${f.busqueda.trim().toLowerCase()}:${f.pagina}`;

export async function consultarCategorias(): Promise<Pick<Categoria, 'id' | 'nombre'>[]> {
  const { data, error } = await supabasePublico.from('categorias').select('id, nombre').order('nombre');
  if (error) throw error;
  return data ?? [];
}

// Se piden solo las columnas que usa la tarjeta: respuestas más chicas, menos para transferir.
export async function consultarProductos(f: FiltroTienda): Promise<PaginaProductos> {
  const desde = (f.pagina - 1) * POR_PAGINA;
  let q = supabasePublico
    .from('productos')
    .select('id, nombre, descripcion, precio, stock, categoria_id, imagen_path, vigente_desde, vigente_hasta, categorias(nombre)', { count: 'exact' })
    .lte('vigente_desde', hoy()).gte('vigente_hasta', hoy())
    .order('nombre')
    .range(desde, desde + POR_PAGINA - 1);
  if (f.categoria) q = q.eq('categoria_id', f.categoria);
  if (f.busqueda.trim()) q = q.ilike('nombre', `%${f.busqueda.trim()}%`);
  const { data, count, error } = await q;
  if (error) throw error;
  return { filas: (data ?? []) as unknown as Producto[], total: count ?? 0 };
}

// Se llama desde main.tsx ANTES de que React arranque: los pedidos salen mientras se
// descarga y se evalúa el resto del JavaScript.
export function precargarCatalogo() {
  precargar(CLAVE_CATEGORIAS, consultarCategorias, true);
  const inicial: FiltroTienda = { categoria: '', busqueda: '', pagina: 1 };
  precargar(claveProductos(inicial), () => consultarProductos(inicial), true);
}

export function precargarCategoria(categoria: string, pagina = 1) {
  const f: FiltroTienda = { categoria, busqueda: '', pagina };
  precargar(claveProductos(f), () => consultarProductos(f), true);
}

// En un momento ocioso se trae la primera página de cada categoría: al tocar un botón
// los productos ya están en caché y aparecen sin esperar a la red.
export function precargarTodasLasCategorias(categorias: { id: number }[]) {
  return cuandoEsteLibre(() => categorias.forEach((c) => precargarCategoria(String(c.id))));
}
