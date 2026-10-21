import { useEffect, useRef, useState } from 'react';

// Concepto · Mientras la imagen baja se ve un esqueleto con brillo (no un cuadro gris fijo) y al
// llegar aparece con un fundido. El tamaño (4:3) está reservado de antemano: la página no salta.
export function ImagenProducto({ src, alt, prioridad }: { src: string; alt: string; prioridad: 'alta' | 'normal' | 'baja' }) {
  const ref = useRef<HTMLImageElement>(null);
  const [lista, setLista] = useState(false);
  const [fallo, setFallo] = useState(false);

  // Si la imagen ya estaba en la caché del navegador, onLoad puede haber ocurrido antes de engancharse.
  useEffect(() => { setLista(false); setFallo(false); if (ref.current?.complete && ref.current.naturalWidth > 0) setLista(true); }, [src]);

  return (
    <div className={`marco-img${lista || fallo ? ' lista' : ''}`}>
      {fallo
        ? <span className="sin-imagen">Sin imagen</span>
        : <img ref={ref} src={src} alt={alt} width={640} height={480} decoding="async"
            loading={prioridad === 'baja' ? 'lazy' : 'eager'} fetchPriority={prioridad === 'alta' ? 'high' : 'auto'}
            onLoad={() => { performance.mark(`imagen-lista:${alt}`); setLista(true); }} onError={() => setFallo(true)} />}
    </div>
  );
}
