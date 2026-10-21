import { supabase } from './supabase';

// Concepto · Storage guarda los archivos; la base guarda solo la RUTA (productos.imagen_path).
// El bucket 'productos' es PÚBLICO: cualquiera con la URL puede leer la imagen.
// Subir, reemplazar o borrar exige ser admin (policies sobre storage.objects, ver schema.sql).
export const BUCKET = 'productos';
export const MAX_BYTES = 2 * 1024 * 1024; // el bucket también lo exige en el servidor
export const TIPOS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// Validar acá mejora la experiencia (avisa antes de subir), pero NO es seguridad:
// el control real es el del bucket (file_size_limit y allowed_mime_types).
export function validarImagen(file: File): string | null {
  if (!TIPOS[file.type]) return 'Solo se aceptan imágenes JPG, PNG o WebP.';
  if (file.size > MAX_BYTES) return 'La imagen supera los 2 MB.';
  return null;
}

export function urlImagen(path?: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Cada subida usa un nombre NUEVO (uuid) en lugar de sobrescribir: así el CDN nunca sirve
// una versión vieja en caché y no hace falta el permiso de upsert.
export async function subirImagen(file: File): Promise<string> {
  const path = `${crypto.randomUUID()}.${TIPOS[file.type]}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
  });
  if (error) throw error;
  return path;
}

// Borrar la fila del producto NO borra el archivo: hay que quitarlo de Storage aparte.
export async function borrarImagen(path?: string | null) {
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}
