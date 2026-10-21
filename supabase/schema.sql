-- =============================================================================
-- schema.sql · E-commerce IFTS 16 sobre Supabase
-- =============================================================================
-- Cómo ejecutarlo: Supabase Studio > SQL Editor > New query > pegar > Run.
-- Es idempotente: se puede correr más de una vez. Solo datos ficticios.
--
-- Mapa respecto del repo original (Express + Sequelize):
--   controllers + models  -> tablas y políticas RLS
--   authMiddleware/isAdmin -> función is_admin() + políticas
--   checkoutController     -> función crear_pedido() (RPC), transaccional
--   clients                -> profiles (los clientes son usuarios de Supabase Auth)

-- 1. ROLES Y PERFILES --------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('cliente', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  full_name  TEXT NOT NULL,
  role       public.user_role NOT NULL DEFAULT 'cliente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Concepto · El rol NUNCA se lee de raw_user_meta_data: lo escribe quien se registra.
-- Todo usuario nuevo nace 'cliente'; el primer admin se promueve a mano (README).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    'cliente'
  );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. CATÁLOGO ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categorias (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      TEXT NOT NULL UNIQUE CHECK (length(trim(nombre)) > 0),
  descripcion TEXT
);

CREATE TABLE IF NOT EXISTS public.productos (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre         TEXT NOT NULL CHECK (length(trim(nombre)) > 0),
  descripcion    TEXT,
  marca          TEXT,
  tipo           TEXT,
  precio         NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  stock          INT NOT NULL CHECK (stock >= 0),
  categoria_id   BIGINT NOT NULL REFERENCES public.categorias(id) ON DELETE RESTRICT,
  vigente_desde  DATE NOT NULL DEFAULT '2000-01-01',
  vigente_hasta  DATE NOT NULL DEFAULT '2099-12-31',
  imagen_path    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (vigente_hasta >= vigente_desde)
);
-- Para bases creadas antes de agregar imágenes (CREATE TABLE IF NOT EXISTS no agrega columnas).
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS imagen_path TEXT;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS marca TEXT;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS tipo TEXT;
CREATE INDEX IF NOT EXISTS productos_categoria_idx ON public.productos (categoria_id);
-- Filtrar por categoría y tipo (por ejemplo Tecnología > Celulares) usa este índice.
CREATE INDEX IF NOT EXISTS productos_categoria_tipo_idx ON public.productos (categoria_id, tipo);

CREATE TABLE IF NOT EXISTS public.descuentos (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo       TEXT NOT NULL UNIQUE CHECK (codigo = upper(trim(codigo)) AND length(codigo) > 0),
  porcentaje   NUMERIC(5,2) NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 100),
  monto_minimo NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (monto_minimo >= 0),
  publico      BOOLEAN NOT NULL DEFAULT false
);
-- Para bases creadas antes de existir la columna.
ALTER TABLE public.descuentos ADD COLUMN IF NOT EXISTS publico BOOLEAN NOT NULL DEFAULT false;

-- 3. PEDIDOS ---------------------------------------------------------------------------
-- A diferencia del repo original (que no guardaba el pedido), acá queda persistido.
CREATE TABLE IF NOT EXISTS public.pedidos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  subtotal         NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  descuento        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
  total            NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  codigo_descuento TEXT,
  estado           TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente', 'confirmado', 'entregado', 'cancelado')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedidos_user_idx ON public.pedidos (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pedido_detalles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  -- Si se borra el producto, el historial se conserva gracias al nombre copiado.
  producto_id     BIGINT REFERENCES public.productos(id) ON DELETE SET NULL,
  producto_nombre TEXT NOT NULL,
  cantidad        INT NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0)
);
CREATE INDEX IF NOT EXISTS detalles_pedido_idx ON public.pedido_detalles (pedido_id);

-- 4. HELPER is_admin() -------------------------------------------------------------------
-- SECURITY DEFINER: lee profiles salteando su RLS, así las políticas pueden preguntar
-- "¿es admin?" sin caer en recursión infinita.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin');
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 5. CHECKOUT TRANSACCIONAL (reemplaza a checkoutController + commitPurchase) -----------
-- Concepto · El navegador NO decide precios, stock ni descuentos: manda solo
-- [{ "producto_id": 1, "cantidad": 2 }] y un código. Todo lo demás lo calcula la base
-- con los datos reales. Si algo falla, RAISE EXCEPTION deshace la transacción entera
-- (el pedido y los descuentos de stock se revierten juntos).
-- FOR UPDATE bloquea la fila del producto: dos compras simultáneas no pueden vender
-- la misma última unidad.
CREATE OR REPLACE FUNCTION public.crear_pedido(p_items JSONB, p_codigo TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := (SELECT auth.uid());
  v_pedido    UUID;
  v_item      JSONB;
  v_prod      public.productos%ROWTYPE;
  v_cantidad  INT;
  v_subtotal  NUMERIC(10,2) := 0;
  v_desc      public.descuentos%ROWTYPE;
  v_descuento NUMERIC(10,2) := 0;
  v_codigo    TEXT := NULLIF(upper(trim(COALESCE(p_codigo, ''))), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Tenés que iniciar sesión para comprar.' USING ERRCODE = '28000';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El carrito está vacío.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'El carrito supera el máximo de 50 renglones.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.pedidos (user_id, subtotal, total) VALUES (v_uid, 0, 0) RETURNING id INTO v_pedido;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    BEGIN
      v_cantidad := (v_item->>'cantidad')::INT;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Cantidad inválida.' USING ERRCODE = '22023';
    END;
    IF v_cantidad IS NULL OR v_cantidad <= 0 OR v_cantidad > 100 THEN
      RAISE EXCEPTION 'Cantidad inválida (1 a 100).' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_prod FROM public.productos
     WHERE id = (v_item->>'producto_id')::BIGINT
       AND CURRENT_DATE BETWEEN vigente_desde AND vigente_hasta
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto % no encontrado o fuera de vigencia.', v_item->>'producto_id' USING ERRCODE = 'P0002';
    END IF;
    IF v_prod.stock < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para "%" (quedan %).', v_prod.nombre, v_prod.stock USING ERRCODE = '23514';
    END IF;

    UPDATE public.productos SET stock = stock - v_cantidad WHERE id = v_prod.id;
    INSERT INTO public.pedido_detalles (pedido_id, producto_id, producto_nombre, cantidad, precio_unitario)
    VALUES (v_pedido, v_prod.id, v_prod.nombre, v_cantidad, v_prod.precio);
    v_subtotal := v_subtotal + v_prod.precio * v_cantidad;
  END LOOP;

  IF v_codigo IS NOT NULL THEN
    SELECT * INTO v_desc FROM public.descuentos WHERE codigo = v_codigo;
    IF NOT FOUND OR v_subtotal < v_desc.monto_minimo THEN
      RAISE EXCEPTION 'El código de descuento no es válido para esta compra.' USING ERRCODE = '22023';
    END IF;
    v_descuento := round(v_subtotal * v_desc.porcentaje / 100, 2);
  END IF;

  UPDATE public.pedidos
     SET subtotal = v_subtotal, descuento = v_descuento, total = v_subtotal - v_descuento,
         codigo_descuento = v_codigo
   WHERE id = v_pedido;
  RETURN v_pedido;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.crear_pedido(JSONB, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.crear_pedido(JSONB, TEXT) TO authenticated;

-- Vista previa del descuento para el carrito (no escribe nada, no toca stock).
CREATE OR REPLACE FUNCTION public.previsualizar_descuento(p_subtotal NUMERIC, p_codigo TEXT)
RETURNS NUMERIC
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT round(p_subtotal * porcentaje / 100, 2) FROM public.descuentos
      WHERE codigo = upper(trim(p_codigo)) AND p_subtotal >= monto_minimo),
    0);
$$;
REVOKE EXECUTE ON FUNCTION public.previsualizar_descuento(NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.previsualizar_descuento(NUMERIC, TEXT) TO authenticated;

-- 6. RLS: activar en TODAS las tablas -------------------------------------------------------
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.descuentos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_detalles ENABLE ROW LEVEL SECURITY;

-- profiles: cada uno ve el suyo; el admin ve y edita todos.
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin());
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- categorias: catálogo público (hasta sin sesión); solo el admin escribe.
DROP POLICY IF EXISTS "categorias_select" ON public.categorias;
CREATE POLICY "categorias_select" ON public.categorias FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "categorias_admin_insert" ON public.categorias;
CREATE POLICY "categorias_admin_insert" ON public.categorias FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "categorias_admin_update" ON public.categorias;
CREATE POLICY "categorias_admin_update" ON public.categorias FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "categorias_admin_delete" ON public.categorias;
CREATE POLICY "categorias_admin_delete" ON public.categorias FOR DELETE TO authenticated USING (public.is_admin());

-- productos: el público ve solo los vigentes; el admin ve y edita todos.
-- El stock lo descuenta crear_pedido(); ningún cliente lo modifica directamente.
-- Concepto · Las políticas permisivas se combinan con OR. Se separan en dos porque
-- is_admin() no es ejecutable por 'anon': si una política para anon la nombrara,
-- toda lectura sin sesión fallaría con "permission denied for function is_admin".
DROP POLICY IF EXISTS "productos_select" ON public.productos;
DROP POLICY IF EXISTS "productos_select_vigentes" ON public.productos;
CREATE POLICY "productos_select_vigentes" ON public.productos FOR SELECT TO anon, authenticated
  USING (CURRENT_DATE BETWEEN vigente_desde AND vigente_hasta);
DROP POLICY IF EXISTS "productos_select_admin" ON public.productos;
CREATE POLICY "productos_select_admin" ON public.productos FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS "productos_admin_insert" ON public.productos;
CREATE POLICY "productos_admin_insert" ON public.productos FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "productos_admin_update" ON public.productos;
CREATE POLICY "productos_admin_update" ON public.productos FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "productos_admin_delete" ON public.productos;
CREATE POLICY "productos_admin_delete" ON public.productos FOR DELETE TO authenticated USING (public.is_admin());

-- descuentos: hay dos clases de códigos.
--   * publico = true  -> se muestran en la tienda como promociones (cualquiera los puede leer).
--   * publico = false -> son confidenciales (por ejemplo, un código VIP): solo el admin los ve y
--     los clientes los usan escribiéndolos, a través de crear_pedido().
-- Concepto · RLS filtra FILAS: la misma tabla devuelve cosas distintas según quién consulta.
-- La policy pública es TO anon, authenticated y no llama a is_admin() (anon no puede ejecutarla).
DROP POLICY IF EXISTS "descuentos_admin_all" ON public.descuentos;
CREATE POLICY "descuentos_admin_all" ON public.descuentos FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "descuentos_select_publicos" ON public.descuentos;
CREATE POLICY "descuentos_select_publicos" ON public.descuentos FOR SELECT TO anon, authenticated
  USING (publico);

-- pedidos: lectura propia o admin. NO hay INSERT para clientes: solo crear_pedido() crea.
DROP POLICY IF EXISTS "pedidos_select" ON public.pedidos;
CREATE POLICY "pedidos_select" ON public.pedidos FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());
DROP POLICY IF EXISTS "pedidos_update_admin" ON public.pedidos;
CREATE POLICY "pedidos_update_admin" ON public.pedidos FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "detalles_select" ON public.pedido_detalles;
CREATE POLICY "detalles_select" ON public.pedido_detalles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id = pedido_id AND (p.user_id = (SELECT auth.uid()) OR public.is_admin())
  ));

-- 7. VISTA para el panel admin (security_invoker: respeta RLS de quien consulta) ---------------
CREATE OR REPLACE VIEW public.resumen_pedidos_por_estado
WITH (security_invoker = true) AS
  SELECT estado, COUNT(*)::INT AS cantidad, COALESCE(SUM(total), 0)::NUMERIC(12,2) AS total
  FROM public.pedidos GROUP BY estado;

-- 8. PERMISOS de la API ------------------------------------------------------------------------
REVOKE ALL ON public.profiles, public.categorias, public.productos, public.descuentos,
              public.pedidos, public.pedido_detalles, public.resumen_pedidos_por_estado FROM anon, authenticated;
GRANT SELECT                         ON public.categorias, public.productos, public.descuentos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias, public.productos, public.descuentos TO authenticated;
GRANT SELECT, UPDATE                 ON public.profiles, public.pedidos TO authenticated;
GRANT SELECT                         ON public.pedido_detalles, public.resumen_pedidos_por_estado TO authenticated;

-- 9. STORAGE: imágenes de productos --------------------------------------------------------------
-- Concepto · Un bucket es una "carpeta raíz" de archivos. La base guarda solo la RUTA
-- (productos.imagen_path); el archivo vive en Storage y se sirve por CDN.
--
-- Bucket PÚBLICO: cualquiera con la URL puede LEER la imagen (no hace falta policy de SELECT
-- para eso). Es lo correcto para fotos de catálogo. Para archivos privados (comprobantes,
-- documentos) se usa un bucket NO público y URLs firmadas temporales (createSignedUrl).
--
-- Escribir NO es público: sin policies en storage.objects nadie puede subir ni borrar.
-- Las restricciones del bucket (tamaño y tipos) las aplica el servidor de Storage, no el front.
-- Se excluye image/svg+xml a propósito: un SVG puede llevar scripts.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('productos', 'productos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Solo el admin sube, reemplaza o borra imágenes. Subir exige INSERT; sobrescribir
-- (upsert) exige además SELECT y UPDATE.
DROP POLICY IF EXISTS "productos_img_admin_select" ON storage.objects;
CREATE POLICY "productos_img_admin_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'productos' AND public.is_admin());
DROP POLICY IF EXISTS "productos_img_admin_insert" ON storage.objects;
CREATE POLICY "productos_img_admin_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'productos' AND public.is_admin());
DROP POLICY IF EXISTS "productos_img_admin_update" ON storage.objects;
CREATE POLICY "productos_img_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'productos' AND public.is_admin())
  WITH CHECK (bucket_id = 'productos' AND public.is_admin());
DROP POLICY IF EXISTS "productos_img_admin_delete" ON storage.objects;
CREATE POLICY "productos_img_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'productos' AND public.is_admin());
