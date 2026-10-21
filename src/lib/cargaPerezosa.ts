import { lazy, type ComponentType } from 'react';

// Concepto · Cada despliegue cambia el nombre (hash) de los archivos de código. Una pestaña que
// quedó abierta durante el despliegue pide archivos que ya no existen y la pantalla falla.
// Si pasa, se recarga la página UNA vez para traer la versión nueva.
const CLAVE = 'recarga-por-version';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cargaPerezosa<T extends ComponentType<any>>(importador: () => Promise<{ default: T }>) {
  return lazy(() => importador().then(
    (m) => { try { sessionStorage.removeItem(CLAVE); } catch { /* se ignora */ } return m; },
    (error) => {
      let yaRecargo = false;
      try { yaRecargo = sessionStorage.getItem(CLAVE) === '1'; sessionStorage.setItem(CLAVE, '1'); } catch { /* se ignora */ }
      if (!yaRecargo) { location.reload(); return new Promise<never>(() => {}); }
      throw error;
    },
  ));
}
