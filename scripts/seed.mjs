// Carga el catálogo de demo (categorías, productos con imagen, descuentos, usuarios y pedidos).
// Idempotente: si lo corrés dos veces no duplica nada.
//   npm run seed             agrega lo que falta
//   npm run seed -- --reset  BORRA pedidos y productos de la demo y los vuelve a cargar
// Todo es ficticio (nombres, precios y descripciones): no representa una tienda real.
import fs from 'node:fs';
import { admin, USUARIOS_DEMO, asegurarUsuario, conSesion, PASSWORD_DEMO } from './_clientes.mjs';

const CATEGORIAS = {
  Ropa: 'Indumentaria para todos los días',
  Calzado: 'Zapatillas, botas y sandalias',
  Accesorios: 'Mochilas, gorras, lentes y relojes',
  'Tecnología': 'Auriculares, periféricos y cargadores',
  Hogar: 'Objetos para la casa',
};

// slug = nombre del archivo en assets/productos/<slug>.png (ver assets/generador/)
const CATALOGO = [
  ['remera', 'Ropa', 'Remera de algodón peinado', 12900, 60, 'Remera lisa de algodón 100 % peinado, corte regular.'],
  ['buzo', 'Ropa', 'Buzo canguro con capucha', 38900, 35, 'Buzo de friza con capucha y bolsillo canguro, interior suave.'],
  ['jean', 'Ropa', 'Jean clásico recto', 42500, 40, 'Jean de denim rígido, tiro medio y corte recto.'],
  ['campera', 'Ropa', 'Campera de abrigo acolchada', 89900, 18, 'Campera acolchada liviana con cierre y cuello alto.'],
  ['zapatillas', 'Calzado', 'Zapatillas urbanas', 79900, 30, 'Zapatillas livianas con suela de goma y plantilla acolchada.'],
  ['botas', 'Calzado', 'Botas de cuero', 96500, 14, 'Botas de cuero vacuno con puntera reforzada.'],
  ['sandalias', 'Calzado', 'Sandalias de verano', 29900, 45, 'Sandalias con tiras ajustables y suela antideslizante.'],
  ['mocasines', 'Calzado', 'Mocasines clásicos', 58900, 22, 'Mocasines de cuero sintético con suela flexible.'],
  ['mochila', 'Accesorios', 'Mochila urbana 20 L', 45900, 28, 'Mochila de 20 litros con bolsillo frontal y espalda acolchada.'],
  ['gorra', 'Accesorios', 'Gorra con visera', 14900, 70, 'Gorra de gabardina con cierre regulable.'],
  ['lentes', 'Accesorios', 'Lentes de sol con filtro UV', 32500, 38, 'Lentes con filtro UV400 y marco liviano.'],
  ['reloj', 'Accesorios', 'Reloj analógico', 67900, 12, 'Reloj de pulsera analógico resistente al agua.'],
  ['auriculares', 'Tecnología', 'Auriculares inalámbricos', 54900, 25, 'Auriculares Bluetooth con micrófono y diadema ajustable.'],
  ['mouse', 'Tecnología', 'Mouse inalámbrico', 18900, 50, 'Mouse óptico inalámbrico con receptor USB.'],
  ['cargador', 'Tecnología', 'Cargador USB-C 20 W', 12500, 80, 'Cargador de pared de carga rápida con salida USB-C.'],
  ['parlante', 'Tecnología', 'Parlante Bluetooth portátil', 49900, 20, 'Parlante portátil con conexión Bluetooth y asa de transporte.'],
  ['lampara', 'Hogar', 'Lámpara de mesa', 27900, 26, 'Lámpara de mesa con pantalla de tela, ideal para escritorio.'],
  ['taza', 'Hogar', 'Taza de cerámica', 6900, 100, 'Taza de cerámica de 350 ml, apta para lavavajillas.'],
  ['almohadon', 'Hogar', 'Almohadón decorativo', 11900, 55, 'Almohadón de 45 × 45 cm con relleno hipoalergénico.'],
  ['maceta', 'Hogar', 'Maceta con planta', 15500, 33, 'Planta de interior con maceta de cerámica.'],
];

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
for (const [slug, categoria, nombre, precio, stock, descripcion] of CATALOGO) {
  const ruta = `seed/${slug}.png`;
  const archivo = fs.readFileSync(new URL(`../assets/productos/${slug}.png`, import.meta.url));
  const { error: errImg } = await admin.storage.from('productos').upload(ruta, archivo, { contentType: 'image/png', upsert: true });
  if (errImg) throw errImg;

  const { data: existe } = await admin.from('productos').select('id').eq('nombre', nombre).maybeSingle();
  const fila = { nombre, descripcion, precio, categoria_id: idCategoria[categoria], imagen_path: ruta };
  const { error } = existe
    ? await admin.from('productos').update(fila).eq('id', existe.id)
    : await admin.from('productos').insert({ ...fila, stock });
  if (error) throw error;
}
// Un producto vencido, para mostrar la vigencia: no aparece en la tienda, sí en el admin.
const { data: vencido } = await admin.from('productos').select('id').like('nombre', 'Bufanda de lana%').maybeSingle();
if (!vencido) {
  const { error } = await admin.from('productos').insert({
    nombre: 'Bufanda de lana (fuera de temporada)', descripcion: 'Bufanda tejida de lana; ya no está a la venta.', precio: 9900, stock: 5,
    categoria_id: idCategoria.Ropa, vigente_hasta: '2025-12-31',
  });
  if (error) throw error;
}

// 3) Descuentos: uno general y otro que exige una compra mínima
const { error: errDesc } = await admin.from('descuentos').upsert([
  { codigo: 'BIENVENIDA10', porcentaje: 10, monto_minimo: 0 },
  { codigo: 'VERANO20', porcentaje: 20, monto_minimo: 50000 },
], { onConflict: 'codigo' });
if (errDesc) throw errDesc;

// 4) Usuarios demo
for (const u of USUARIOS_DEMO) await asegurarUsuario(u);

// 5) Pedidos de ejemplo, hechos a través de crear_pedido() como los haría un cliente real
const { count } = await admin.from('pedidos').select('*', { count: 'exact', head: true });
if (!count) {
  const { data: prods } = await admin.from('productos').select('id').lte('vigente_desde', hoy).gte('vigente_hasta', hoy).order('nombre').limit(10);
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
console.log(`Listo: ${CATALOGO.length} productos con imagen. Admin: admin@demo.test / ${PASSWORD_DEMO} · Clientes: cliente1@demo.test, cliente2@demo.test`);
