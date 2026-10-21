// Concepto · Caché "stale-while-revalidate": se muestra al instante lo que hay guardado y se
// actualiza en segundo plano. Sirve para que la tienda no espere a la red (cada pedido a
// Supabase cuesta ~0,3 s desde Argentina hacia una región lejana).
//
// SOLO se guardan datos públicos (catálogo). Nunca pedidos, perfiles ni nada de una sesión:
// localStorage lo puede leer cualquier script de la página.
const PREFIJO = 'ifts16-cache:v1:';
export const FRESCO_MS = 60_000;        // menos de 1 min: se usa tal cual, sin volver a pedir
const VENCE_MS = 24 * 60 * 60 * 1000;   // más de 1 día: se descarta

interface Entrada<T> { datos: T; guardado: number }

const memoria = new Map<string, Entrada<unknown>>();
const enVuelo = new Map<string, Promise<unknown>>();

export function leer<T>(clave: string): Entrada<T> | undefined {
  let e = memoria.get(clave);
  if (!e) {
    try {
      const crudo = localStorage.getItem(PREFIJO + clave);
      if (crudo) { e = JSON.parse(crudo) as Entrada<unknown>; memoria.set(clave, e); }
    } catch { /* modo privado o JSON dañado: se ignora */ }
  }
  if (e && Date.now() - e.guardado > VENCE_MS) return undefined;
  return e as Entrada<T> | undefined;
}

export function esFresco(clave: string): boolean {
  const e = leer(clave);
  return Boolean(e && Date.now() - e.guardado < FRESCO_MS);
}

function guardar(clave: string, datos: unknown, persistir: boolean) {
  const entrada = { datos, guardado: Date.now() };
  memoria.set(clave, entrada);
  if (!persistir) return;
  try { localStorage.setItem(PREFIJO + clave, JSON.stringify(entrada)); } catch { /* cuota llena: se ignora */ }
}

// Pide los datos una sola vez aunque varios componentes los necesiten a la vez.
export function pedir<T>(clave: string, cargador: () => Promise<T>, persistir = false): Promise<T> {
  const previo = enVuelo.get(clave);
  if (previo) return previo as Promise<T>;
  const promesa = cargador()
    .then((datos) => { guardar(clave, datos, persistir); return datos; })
    .finally(() => enVuelo.delete(clave));
  enVuelo.set(clave, promesa);
  return promesa;
}

// Precarga silenciosa: no hace nada si ya hay datos frescos.
export function precargar<T>(clave: string, cargador: () => Promise<T>, persistir = false) {
  if (!esFresco(clave)) pedir(clave, cargador, persistir).catch(() => { /* se reintentará al usarlo */ });
}

// Tras un cambio (una compra, o el admin editando el catálogo) los datos guardados ya no valen.
export function invalidar(prefijo: string) {
  for (const k of [...memoria.keys()]) if (k.startsWith(prefijo)) memoria.delete(k);
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIJO + prefijo)) localStorage.removeItem(k);
  } catch { /* se ignora */ }
}

// requestIdleCallback no existe en Safari: se usa un temporizador corto como alternativa.
export function cuandoEsteLibre(fn: () => void): number {
  if (typeof window.requestIdleCallback === 'function') return window.requestIdleCallback(fn, { timeout: 2000 });
  return setTimeout(fn, 300) as unknown as number;
}
