import { useEffect, useState } from 'react';

// Concepto · Debounce: espera a que el usuario deje de escribir antes de consultar,
// así no se dispara una consulta a Supabase por cada tecla.
export function useDebounce<T>(valor: T, ms = 300): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}
