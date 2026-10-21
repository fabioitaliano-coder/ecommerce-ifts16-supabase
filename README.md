# E-commerce IFTS 16 · Supabase

Versión **avanzada y cerrada** de la app de referencia de Práctica Profesionalizante II · IFTS 16. Es el mismo dominio que [`ecommerce-ifts16`](https://github.com/fabioitaliano-coder/ecommerce-ifts16) (productos, categorías, descuentos y checkout), pero con **Supabase como backend (BaaS)** y un front en **React + Vite + TypeScript**. No hay servidor propio: el navegador habla directo con Supabase y la seguridad vive en la base de datos.

> Para una app más chica, pensada para consultar y copiar, mirá `pp2-starter-supabase`.

Datos 100 % ficticios (Ley 25.326). Licencia MIT.

## Qué incluye

- **Tienda pública:** catálogo con búsqueda, filtro por categoría y paginación. Se ve sin iniciar sesión.
- **Carrito y checkout:** el carrito vive en el navegador, pero la compra la resuelve la función de base de datos `crear_pedido()`.
- **Cuenta del cliente:** registro, login e historial de pedidos con detalle.
- **Administración (solo rol admin):** pedidos con cambio de estado y resumen, productos con vigencia, stock e **imagen**, categorías, códigos de descuento y clientes (con cambio de rol).
- **Imágenes de productos con Supabase Storage:** el admin sube una foto desde el formulario; se guarda en un bucket público y la base conserva solo la ruta.

## Qué tiene de distinto frente al repo original

| En `ecommerce-ifts16` (Express + Sequelize) | Acá (Supabase) |
| :--- | :--- |
| Controladores y modelos | Tablas y **políticas RLS** (`supabase/schema.sql`) |
| `authMiddleware` + `isAdmin` | Función `is_admin()` + políticas por rol |
| `checkoutController` con transacción | Función `crear_pedido()` (RPC), transaccional |
| El pedido no se guardaba | El pedido queda en `pedidos` y `pedido_detalles` |
| Tabla `clients` | `profiles`, ligada a Supabase Auth |

## Seguridad: lo que conviene mirar

1. **El navegador no decide precios, stock ni descuentos.** Manda solo `producto_id` y `cantidad`; `crear_pedido()` calcula todo con los datos reales, bloquea las filas (`FOR UPDATE`) y, si algo falla, revierte la transacción entera.
2. **El rol nunca viene del cliente.** El trigger `handle_new_user()` crea todo perfil como `cliente`; lo que mande `signUp` en el metadata se ignora.
3. **Los códigos de descuento son confidenciales:** los clientes no pueden leer la tabla, solo usarlos a través de las funciones.
4. **Dos capas:** el front filtra (`user_id`) y además RLS lo exige en la base. Las rutas protegidas son comodidad de navegación, no seguridad.
5. **Dos claves, dos destinos:** la *publishable* va en el navegador; la *secret* saltea RLS y solo se usa en `scripts/`, en tu máquina.

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Ingresá a [supabase.com/dashboard](https://supabase.com/dashboard) y elegí **New project**.
2. Poné un nombre, una contraseña de base de datos (guardala en tu gestor de contraseñas) y la región más cercana. Esperá a que el proyecto esté listo.

### 2. Conseguir las claves

1. Botón **Connect** (arriba), pestaña **Frameworks**, **React**: ahí están la **Project URL** y la clave **publishable** (`sb_publishable_…`).
2. **Settings → API Keys**: ahí está también la clave **secret** (`sb_secret_…`).
3. Los proyectos viejos muestran claves `anon` y `service_role`: son las equivalentes antiguas de *publishable* y *secret*.

### 3. Cargar el esquema

**SQL Editor → New query**, pegá todo `supabase/schema.sql` y **Run**. Después, en **Table Editor**, verificá que existan `profiles`, `categorias`, `productos`, `descuentos`, `pedidos` y `pedido_detalles`, todas con RLS activado.

### 4. Variables de entorno

```bash
cp .env.example .env
```

Completá `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`. El `.env` está en `.gitignore`. La secret **no** lleva prefijo `VITE_` y **no** se carga en el hosting.

### 5. Datos de prueba, pruebas y desarrollo

```bash
npm install
npm run seed       # 5 categorías, 20 productos con imagen, 2 descuentos, 3 usuarios demo y pedidos
npm run seed -- --reset   # BORRA pedidos y productos de la demo y los vuelve a cargar
npm run test:rls   # 26 pruebas que intentan romper la seguridad, el checkout y Storage
npm run dev        # http://localhost:5173
```

Usuarios demo (ficticios): `admin@demo.test`, `cliente1@demo.test` y `cliente2@demo.test`, todos con la contraseña `demo1234`. Códigos de descuento: `BIENVENIDA10` (10 %) y `VERANO20` (20 %, compra mínima de $50.000).

## Imágenes con Supabase Storage

Las fotos de los productos viven en un **bucket**, no en la base de datos. La tabla `productos` guarda solo la ruta (`imagen_path`); el archivo se sirve por CDN.

| Decisión | Por qué |
| :--- | :--- |
| Bucket **público** `productos` | Las fotos de catálogo son públicas: se leen con una URL, sin sesión y sin política de lectura. |
| **Escritura solo del admin** | Políticas `INSERT`, `UPDATE`, `DELETE` y `SELECT` sobre `storage.objects` con `is_admin()`. Sin ellas, nadie puede subir ni borrar. |
| Límite de **2 MB** y solo **JPG, PNG y WebP** | Lo aplica el servidor de Storage (`file_size_limit`, `allowed_mime_types`). Validar en el formulario es solo cortesía. |
| **Sin SVG** | Un SVG puede contener scripts. |
| Nombre **nuevo (uuid)** en cada subida | El CDN no sirve una versión vieja en caché, y no hace falta el permiso de sobrescribir. |
| Borrar el archivo al **borrar o reemplazar** el producto | Borrar la fila no borra el archivo: quedaría huérfano. |

Para archivos **privados** (comprobantes, documentos) se usa un bucket no público y enlaces temporales (`createSignedUrl`). Está explicado en el Anexo 5 de la guía.

## Catálogo de demo e imágenes

El seed carga una tienda ficticia con **5 categorías y 4 productos por categoría** (Ropa, Calzado, Accesorios, Tecnología y Hogar), con precios en pesos, una descripción corta y una imagen. También agrega un producto **vencido** (la bufanda) para mostrar la vigencia: no aparece en la tienda, pero el admin lo ve.

Las imágenes son **ilustraciones originales** con un estilo común (una paleta por categoría, mismo encuadre y misma sombra), no fotos. Están en `assets/productos/` y el seed las sube al bucket. Se generaron con `assets/generador/generar-imagenes.mjs`, que usa `sharp` solo para eso (no es una dependencia del proyecto):

```bash
npm install --no-save sharp
node assets/generador/generar-imagenes.mjs assets/productos
```

Para usar fotos reales, el admin puede reemplazar cualquier imagen desde **Administración → Productos → Editar**. Si las vas a publicar, verificá que tengas la licencia.

## Primer administrador

El registro siempre crea un `cliente`. Para promover al primero, ejecutá en el SQL Editor:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'tu_email@ejemplo.com';
```

Después, ese admin puede cambiar roles desde **Administración → Clientes**.

## Despliegue

Es un sitio estático: `npm run build` genera `dist/`.

- **Render (Static Site):** *Build command* `npm install && npm run build`, *Publish directory* `dist`. Agregá la regla de reescritura `/*` → `/index.html` (ya viene en `public/_redirects`).
- **Vercel:** detecta Vite solo; `vercel.json` ya trae la reescritura a `/index.html`.


En todos los casos, configurá solamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (se incorporan al compilar: si las cambiás, hay que volver a desplegar). Después, en Supabase: **Authentication → URL Configuration** y agregá la dirección pública del sitio.

> **Demo pública:** los usuarios demo tienen clave conocida, incluido un admin. Desplegá contra una base descartable y no cargues datos reales.

## Estructura

```
supabase/schema.sql      Tablas, trigger, RLS, funciones y vista
scripts/                 seed.mjs y test-rls.mjs (usan la clave secret, solo en tu máquina)
src/lib/                 Cliente singleton de Supabase, formatos e imágenes (Storage)
src/context/             Sesión con rol (AuthContext) y carrito (CartContext)
src/hooks/               usePaginado (paginación con .range()) y useDebounce
src/routes/              ProtectedRoute (guarda de navegación)
src/features/            auth · tienda · cliente · admin
```

## Problemas frecuentes

| Síntoma | Causa probable |
| :--- | :--- |
| `permission denied for function is_admin` al leer sin sesión | Una política para `anon` nombra a `is_admin()`, que `anon` no puede ejecutar. Separá la política (ver `productos_select_*`). |
| Una consulta devuelve `[]` con estado 200 | RLS está filtrando todo: revisá la política y el rol del usuario. |
| El carrito muestra un precio y el pedido otro | Es lo esperado: el precio válido es el de la base, no el del navegador. |
| `SUPABASE_SECRET_KEY tiene caracteres inválidos` | Se copió una versión tapada con puntos; copiala completa desde **Settings → API Keys**. |
| `new row violates row-level security policy` al subir una imagen | Quien sube no es admin, o falta una política sobre `storage.objects`. |
| `mime type ... is not supported` | Solo se aceptan JPG, PNG y WebP (`allowed_mime_types` del bucket). |
