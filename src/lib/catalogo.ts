import { supabasePublico } from './supabase';
import { cuandoEsteLibre, precargar, precargarYEsperar } from './cache';
import { hoy } from './formato';
import type { Categoria, Producto, Promo } from '../types';

export const POR_PAGINA = 12;
export const CLAVE_CATEGORIAS = 'tienda:categorias';
export const CLAVE_PROMOS = 'tienda:promos';
export const CLAVE_TIPOS = 'tienda:tipos';

export interface FiltroTienda { categoria: string; tipo: string; busqueda: string; pagina: number }
export interface PaginaProductos { filas: Producto[]; total: number }

export const claveProductos = (f: FiltroTienda) =>
  `tienda:productos:${f.categoria || 'todas'}:${f.tipo || 'todos'}:${f.busqueda.trim().toLowerCase()}:${f.pagina}`;

export async function consultarCategorias(): Promise<Pick<Categoria, 'id' | 'nombre'>[]> {
  const { data, error } = await supabasePublico.from('categorias').select('id, nombre').order('nombre');
  if (error) throw error;
  return data ?? [];
}

// Tipos disponibles por categoría (Tecnología > Celulares, Auriculares...). Son pocas filas y casi
// no cambian, así que se piden una vez y se guardan en caché.
export interface TipoPorCategoria { categoria_id: number; tipo: string }
export async function consultarTipos(): Promise<TipoPorCategoria[]> {
  const { data, error } = await supabasePublico.from('productos').select('categoria_id, tipo')
    .lte('vigente_desde', hoy()).gte('vigente_hasta', hoy()).not('tipo', 'is', null).limit(1000);
  if (error) throw error;
  const vistos = new Set<string>();
  return ((data ?? []) as TipoPorCategoria[]).filter((r) => { const k = `${r.categoria_id}|${r.tipo}`; return vistos.has(k) ? false : (vistos.add(k), true); })
    .sort((a, b) => a.tipo.localeCompare(b.tipo, 'es'));
}

// Promociones públicas: RLS deja leer sin sesión solo los descuentos marcados como públicos.
// Los privados (por ejemplo un código VIP) no aparecen acá aunque se pidan.
export async function consultarPromos(): Promise<Promo[]> {
  const { data, error } = await supabasePublico.from('descuentos').select('codigo, porcentaje, monto_minimo').eq('publico', true).order('porcentaje');
  if (error) throw error;
  return (data ?? []) as Promo[];
}

// Se piden solo las columnas que usa la tarjeta: respuestas más chicas, menos para transferir.
export async function consultarProductos(f: FiltroTienda): Promise<PaginaProductos> {
  const desde = (f.pagina - 1) * POR_PAGINA;
  let q = supabasePublico
    .from('productos')
    .select('id, nombre, descripcion, marca, tipo, precio, stock, categoria_id, imagen_path, vigente_desde, vigente_hasta, categorias(nombre)', { count: 'exact' })
    .lte('vigente_desde', hoy()).gte('vigente_hasta', hoy())
    .order('nombre')
    .range(desde, desde + POR_PAGINA - 1);
  if (f.categoria) q = q.eq('categoria_id', f.categoria);
  if (f.tipo) q = q.eq('tipo', f.tipo);
  // La búsqueda mira nombre, marca y tipo. Se quitan los caracteres que tienen significado en la
  // sintaxis de filtros de PostgREST (coma, paréntesis, comodines) para que no rompan la consulta.
  const texto = f.busqueda.trim().replace(/[,()*%\\]/g, ' ').trim();
  if (texto) q = q.or(`nombre.ilike.%${texto}%,marca.ilike.%${texto}%,tipo.ilike.%${texto}%`);
  const { data, count, error } = await q;
  if (error) throw error;
  return { filas: (data ?? []) as unknown as Producto[], total: count ?? 0 };
}

// Se llama desde main.tsx ANTES de que React arranque: los pedidos salen mientras se
// descarga y se evalúa el resto del JavaScript.
export function precargarCatalogo() {
  precargar(CLAVE_CATEGORIAS, consultarCategorias, true);
  precargar(CLAVE_PROMOS, consultarPromos, true);
  precargar(CLAVE_TIPOS, consultarTipos, true);
  const inicial: FiltroTienda = { categoria: '', tipo: '', busqueda: '', pagina: 1 };
  precargar(claveProductos(inicial), () => consultarProductos(inicial), true);
}

export function precargarCategoria(categoria: string, pagina = 1) {
  const f: FiltroTienda = { categoria, tipo: '', busqueda: '', pagina };
  precargar(claveProductos(f), () => consultarProductos(f), true);
}

export function precargarTipo(categoria: string, tipo: string) {
  const f: FiltroTienda = { categoria, tipo, busqueda: '', pagina: 1 };
  precargar(claveProductos(f), () => consultarProductos(f), true);
}

// Concepto · La precarga NO debe competir con lo que el usuario está esperando. Por eso:
// 1) espera a que la página termine de cargar (incluidas las imágenes visibles),
// 2) espera a que el navegador esté libre, y
// 3) trae las categorías de a UNA, con una pausa: varias a la vez enlentecían a todas
//    (medido: ~860 ms cada una en paralelo contra ~265 ms una sola).
export function precargarTodasLasCategorias(categorias: { id: number }[]) {
  let cancelado = false;
  const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const arrancar = async () => {
    for (const c of categorias) {
      if (cancelado) return;
      const f: FiltroTienda = { categoria: String(c.id), tipo: '', busqueda: '', pagina: 1 };
      await precargarYEsperar(claveProductos(f), () => consultarProductos(f), true);
      await pausa(250);
    }
  };
  const esperarCarga = document.readyState === 'complete' ? Promise.resolve() : new Promise<void>((r) => addEventListener('load', () => r(), { once: true }));
  esperarCarga.then(() => { if (!cancelado) cuandoEsteLibre(arrancar); });
  return () => { cancelado = true; };
}
