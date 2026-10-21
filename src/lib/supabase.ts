// Concepto · Cliente singleton: se crea UNA vez y todo el proyecto importa este objeto.
// Concepto · Clave publishable: viaja en el bundle del navegador y NO es un secreto.
// La seguridad la ponen las políticas RLS de la base, no esta clave.
// La clave "secret" (sb_secret_...) no se usa jamás acá: solo en scripts/ locales.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// main.tsx muestra un aviso si falta la configuración. Los valores de relleno evitan que
// createClient() lance un error al importar este módulo (y que la página quede en blanco).
export const configurado = Boolean(url && publishableKey);
const urlEfectiva = url || 'https://sin-configurar.invalid';
const claveEfectiva = publishableKey || 'sin-configurar';

// Cliente con sesión: login, carrito, pedidos y administración.
export const supabase = createClient(urlEfectiva, claveEfectiva);

// Concepto · Cliente público: solo lee el catálogo (que RLS ya permite sin sesión).
// Sin sesión no espera a que se restaure ni se renueve ningún token antes de cada pedido,
// y sus datos no dependen de quién esté logueado, así que se pueden guardar en caché.
export const supabasePublico = createClient(urlEfectiva, claveEfectiva, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sb-publico' },
});
