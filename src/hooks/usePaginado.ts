import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { hoy } from '../lib/formato';

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

// Concepto · Paginación por offset: .range(desde, hasta) es inclusivo en ambos extremos y
// { count: 'exact' } devuelve el total sin traer todas las filas. Es el patrón del Anexo 9.
export function usePaginado<T>(tabla: string, o: Opciones) {
  const porPagina = o.porPagina ?? 10;
  const [filas, setFilas] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const clave = JSON.stringify([o.filtros, o.busqueda, o.soloVigentes]);

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
    else { setError(null); setFilas((data as T[]) ?? []); setTotal(count ?? 0); }
    setCargando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabla, pagina, porPagina, clave, o.select, o.orden, o.asc]);

  useEffect(() => { recargar(); }, [recargar]);

  // Si se borró la última fila de la última página, volver a la anterior.
  useEffect(() => {
    if (!cargando && filas.length === 0 && pagina > 1) setPagina(pagina - 1);
  }, [cargando, filas.length, pagina]);

  return { filas, total, pagina, setPagina, porPagina, cargando, error, recargar };
}
