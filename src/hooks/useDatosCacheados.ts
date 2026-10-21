import { useEffect, useState } from 'react';
import { esFresco, leer, pedir } from '../lib/cache';

// Devuelve los datos guardados al instante (si los hay) y los revalida en segundo plano.
// Si no hay nada guardado, `cargando` es true hasta que llegan.
export function useDatosCacheados<T>(clave: string, cargador: () => Promise<T>, persistir = false) {
  const [, redibujar] = useState(0);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    setFallo(false);
    if (esFresco(clave)) return; // ya está en caché y es reciente
    pedir(clave, cargador, persistir)
      .then(() => vivo && redibujar((n) => n + 1))
      .catch(() => vivo && setFallo(true));
    return () => { vivo = false; };
    // El cargador se vuelve a crear en cada render; la clave ya describe qué se pide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const entrada = leer<T>(clave);
  return { datos: entrada?.datos, cargando: !entrada && !fallo, error: fallo && !entrada };
}
