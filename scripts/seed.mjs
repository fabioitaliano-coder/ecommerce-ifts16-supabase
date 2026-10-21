// Carga el catálogo de demo (categorías, productos con imagen, descuentos, usuarios y pedidos).
// Idempotente: si lo corrés dos veces no duplica nada.
//   npm run seed             agrega lo que falta
//   npm run seed -- --reset  BORRA pedidos y productos de la demo y los vuelve a cargar
// Todo es ficticio (nombres, precios y descripciones): no representa una tienda real.
import fs from 'node:fs';
import { admin, USUARIOS_DEMO, asegurarUsuario, conSesion, PASSWORD_DEMO } from './_clientes.mjs';

// Fuente única: assets/catalogo.json (categorías y 75 productos con marca, tipo y modelo).
// Las imágenes de assets/productos/<slug>.webp se generan desde el mismo archivo (ver assets/generador/).
const { categorias: CATEGORIAS, productos: CATALOGO } = JSON.parse(
  fs.readFileSync(new URL('../assets/catalogo.json', import.meta.url), 'utf8'),
);

const hoy = new Date().toISOString().slice(0, 10);

if (process.argv.includes('--reset')) {
  // Borra los datos de demo (pedidos y productos) y los archivos de Storage que cargó este seed.
  await admin.from('pedidos').delete().not('id', 'is', null);
  await admin.from('productos').delete().not('id', 'is', null);
  const { data: archivos } = await admin.storage.from('productos').list('seed', { limit: 1000 });
  if (archivos?.length) await admin.storage.from('productos').remove(archivos.map((a) => `seed/${a.name}`));
  console.log('Datos de demo anteriores borrados.');
}

// 1) Categorías
for (const [nombre, descripcion] of Object.entries(CATEGORIAS)) {
  const { error } = await admin.from('categorias').upsert({ nombre, descripcion }, { onConflict: 'nombre' });
  if (error) throw error;
}
const { data: cats } = await admin.from('categorias').select('id, nombre');
const idCategoria = Object.fromEntries(cats.map((c) => [c.nombre, c.id]));

// 2) Productos + imagen en Storage (bucket público 'productos'; la base guarda solo la ruta)
for (const p of CATALOGO) {
  const ruta = `seed/${p.slug}.webp`;
  const archivo = fs.readFileSync(new URL(`../assets/productos/${p.slug}.webp`, import.meta.url));
  // cacheControl: sin esto Storage responde "no-cache" y el navegador vuelve a pedir cada imagen
  // en cada visita. Un año alcanza porque cada archivo tiene su propio nombre.
  const { error: errImg } = await admin.storage.from('productos').upload(ruta, archivo, {
    contentType: 'image/webp', upsert: true, cacheControl: '31536000',
  });
  if (errImg) throw errImg;

  const { data: existe } = await admin.from('productos').select('id').eq('nombre', p.nombre).maybeSingle();
  const fila = {
    nombre: p.nombre, descripcion: p.descripcion, marca: p.marca, tipo: p.tipo, precio: p.precio,
    categoria_id: idCategoria[p.categoria], imagen_path: ruta,
  };
  const { error } = existe
    ? await admin.from('productos').update(fila).eq('id', existe.id)
    : await admin.from('productos').insert({ ...fila, stock: p.stock });
  if (error) throw error;
}
// Un producto vencido, para mostrar la vigencia: no aparece en la tienda, sí en el admin.
const { data: vencido } = await admin.from('productos').select('id').like('nombre', 'Bufanda de lana%').maybeSingle();
if (!vencido) {
  const { error } = await admin.from('productos').insert({
    nombre: 'Bufanda de lana (fuera de temporada)', marca: 'Hermoso Home', tipo: 'Bufandas', descripcion: 'Bufanda tejida de lana; ya no está a la venta.', precio: 9900, stock: 5,
    categoria_id: idCategoria.Ropa, vigente_hasta: '2025-12-31',
  });
  if (error) throw error;
}

// Limpieza: archivos de seed/ que ya no corresponden a ningún producto (por ejemplo, las versiones .png).
const vigentes = new Set(CATALOGO.map((p) => `${p.slug}.webp`));
const { data: enStorage } = await admin.storage.from('productos').list('seed', { limit: 1000 });
const huerfanos = (enStorage ?? []).filter((a) => !vigentes.has(a.name)).map((a) => `seed/${a.name}`);
if (huerfanos.length) await admin.storage.from('productos').remove(huerfanos);

// 3) Descuentos: dos públicos (se muestran en la tienda) y uno privado (solo se usa si se conoce el código)
const { error: errDesc } = await admin.from('descuentos').upsert([
  { codigo: 'BIENVENIDA10', porcentaje: 10, monto_minimo: 0, publico: true },
  { codigo: 'VERANO20', porcentaje: 20, monto_minimo: 50000, publico: true },
  { codigo: 'VIP30', porcentaje: 30, monto_minimo: 100000, publico: false },
], { onConflict: 'codigo' });
if (errDesc) throw errDesc;

// 4) Usuarios demo
for (const u of USUARIOS_DEMO) await asegurarUsuario(u);

// 5) Pedidos de ejemplo, hechos a través de crear_pedido() como los haría un cliente real
const { count } = await admin.from('pedidos').select('*', { count: 'exact', head: true });
if (!count) {
  const { data: prods } = await admin.from('productos').select('id').lte('vigente_desde', hoy).gte('vigente_hasta', hoy).order('nombre').limit(30);
  const estados = ['pendiente', 'confirmado', 'entregado', 'cancelado'];
  for (const [i, email] of ['cliente1@demo.test', 'cliente2@demo.test'].entries()) {
    const sesion = await conSesion(email);
    for (let n = 0; n < 6; n++) {
      const items = [0, 1].map((k) => ({ producto_id: prods[(n + k + i) % prods.length].id, cantidad: 1 + ((n + k) % 3) }));
      const { data: id, error } = await sesion.rpc('crear_pedido', { p_items: items, p_codigo: n === 2 ? 'BIENVENIDA10' : null });
      if (error) throw error;
      await admin.from('pedidos').update({ estado: estados[(n + i) % 4] }).eq('id', id);
    }
  }
}
console.log(`Listo: ${CATALOGO.length} productos con imagen (${new Set(CATALOGO.map((p) => p.marca)).size} marcas, ${new Set(CATALOGO.map((p) => p.tipo)).size} tipos). Admin: admin@demo.test / ${PASSWORD_DEMO} · Clientes: cliente1@demo.test, cliente2@demo.test`);
