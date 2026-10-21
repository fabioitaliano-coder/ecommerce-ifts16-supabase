import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { hoy } from '../lib/formato';
import { guardar, leer } from '../lib/cache';

interface Opciones {
  select?: string;
  orden: string;
  asc?: boolean;
  porPagina?: number;
  /** Igualdades columna = valor. Los vacíos se ignoran. */
  filtros?: Record<string, string | number | undefined>;
  busqueda?: { columna: string; texto: string };
  soloVigentes?: boolean;
}

interface Resultado<T> { filas: T[]; total: number }

// Concepto · Paginación por offset: .range(desde, hasta) es inclusivo en ambos extremos y
// { count: 'exact' } devuelve el total sin traer todas las filas. Es el patrón del Anexo 9.
export function usePaginado<T>(tabla: string, o: Opciones) {
  const porPagina = o.porPagina ?? 10;
  const [pagina, setPagina] = useState(1);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cargandoRed, setCargandoRed] = useState(true);
  const clave = JSON.stringify([o.filtros, o.busqueda, o.soloVigentes]);
  // Concepto · Caché SOLO en memoria (se pierde al recargar y al cerrar sesión): estos datos son privados.
  const claveCache = `admin:${tabla}:${o.select ?? '*'}:${o.orden}:${o.asc ?? true}:${clave}:${pagina}`;
  const enCache = leer<Resultado<T>>(claveCache);
  const filas = enCache?.datos.filas ?? [];
  const total = enCache?.datos.total ?? 0;
  const cargando = !enCache && cargandoRed;

  useEffect(() => { setPagina(1); }, [clave]);

  const recargar = useCallback(async () => {
    const desde = (pagina - 1) * porPagina;
    // El constructor de consultas de supabase-js cambia de tipo en cada paso; acá se usa como any.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from(tabla).select(o.select ?? '*', { count: 'exact' })
      .order(o.orden, { ascending: o.asc ?? true })
      .range(desde, desde + porPagina - 1);
    for (const [col, val] of Object.entries(o.filtros ?? {})) {
      if (val !== undefined && val !== '') q = q.eq(col, val);
    }
    if (o.busqueda?.texto.trim()) q = q.ilike(o.busqueda.columna, `%${o.busqueda.texto.trim()}%`);
    if (o.soloVigentes) q = q.lte('vigente_desde', hoy()).gte('vigente_hasta', hoy());

    const { data, count, error } = await q;
    if (error) setError('No se pudieron cargar los datos.');
    else { setError(null); guardar(claveCache, { filas: (data as T[]) ?? [], total: count ?? 0 }, false); setVersion((v) => v + 1); }
    setCargandoRed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabla, pagina, porPagina, clave, o.select, o.orden, o.asc, claveCache]);

  useEffect(() => { recargar(); }, [recargar]);

  // Si se borró la última fila de la última página, volver a la anterior.
  useEffect(() => {
    if (!cargando && filas.length === 0 && pagina > 1) setPagina(pagina - 1);
  }, [cargando, filas.length, pagina]);

  void version; // fuerza el redibujado cuando llegan datos nuevos
  return { filas, total, pagina, setPagina, porPagina, cargando, error, recargar };
}
