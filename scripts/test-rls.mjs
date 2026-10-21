// Pruebas de seguridad y de negocio contra TU proyecto de Supabase. Antes: npm run seed
import assert from 'node:assert/strict';
import { admin, nuevoClientePublico, conSesion, asegurarUsuario, USUARIOS_DEMO } from './_clientes.mjs';

let fallos = 0;
async function caso(nombre, fn) {
  try {
    const r = await fn();
    console.log(r?.omitida ? `  omitida ${nombre}\n        ${r.omitida}` : `  ok   ${nombre}`);
  } catch (e) { fallos++; console.log(`  FALLA ${nombre}\n        ${e.message}`); }
}

const ids = {};
for (const u of USUARIOS_DEMO) ids[u.email] = await asegurarUsuario(u);
const [A, B] = [ids['cliente1@demo.test'], ids['cliente2@demo.test']];
const c1 = await conSesion('cliente1@demo.test');
const c2 = await conSesion('cliente2@demo.test');
const adm = await conSesion('admin@demo.test');
const anon = nuevoClientePublico();

// Producto de prueba con stock controlado; se borra al final.
const { data: cat } = await admin.from('categorias').select('id').limit(1).single();
const { data: prueba } = await admin.from('productos')
  .insert({ nombre: `TEST-${Date.now()}`, precio: 100, stock: 3, categoria_id: cat.id }).select().single();
const pedidosCreados = [];
const stockActual = async (id) => (await admin.from('productos').select('stock').eq('id', id).single()).data.stock;
const comprar = async (cli, items, codigo = null) => {
  const r = await cli.rpc('crear_pedido', { p_items: items, p_codigo: codigo });
  if (r.data) pedidosCreados.push(r.data);
  return r;
};

console.log('Catálogo público');
await caso('sin sesión se ven categorías y productos vigentes', async () => {
  const { data: p } = await anon.from('productos').select('nombre');
  assert.ok(p.length > 0);
  assert.ok(!p.some((x) => x.nombre.includes('fuera de temporada')), 'un producto vencido es visible');
});
await caso('sin sesión no se puede crear, editar ni borrar productos', async () => {
  assert.ok((await anon.from('productos').insert({ nombre: 'X', precio: 1, stock: 1, categoria_id: cat.id })).error);
  await anon.from('productos').update({ precio: 1 }).eq('id', prueba.id);
  await anon.from('productos').delete().eq('id', prueba.id);
  const { data } = await admin.from('productos').select('precio').eq('id', prueba.id).single();
  assert.equal(Number(data.precio), 100);
});
await caso('sin sesión no se pueden leer descuentos ni pedidos', async () => {
  assert.equal(((await anon.from('descuentos').select('*')).data ?? []).length, 0);
  assert.equal(((await anon.from('pedidos').select('id')).data ?? []).length, 0);
});

console.log('Permisos de clientes');
await caso('un cliente no puede editar precio ni stock de un producto', async () => {
  await c1.from('productos').update({ precio: 1, stock: 999 }).eq('id', prueba.id);
  const { data } = await admin.from('productos').select('precio, stock').eq('id', prueba.id).single();
  assert.equal(Number(data.precio), 100);
  assert.equal(data.stock, 3);
});
await caso('un cliente no puede leer los códigos de descuento', async () => {
  assert.equal(((await c1.from('descuentos').select('*')).data ?? []).length, 0);
});
await caso('un cliente no puede insertar pedidos directamente', async () => {
  assert.ok((await c1.from('pedidos').insert({ user_id: A, subtotal: 1, total: 1 })).error);
});
await caso('un cliente no puede ascenderse a admin', async () => {
  await c1.from('profiles').update({ role: 'admin' }).eq('id', A);
  assert.equal((await admin.from('profiles').select('role').eq('id', A).single()).data.role, 'cliente');
});
await caso('cliente1 no ve pedidos de cliente2', async () => {
  const { data } = await c1.from('pedidos').select('user_id');
  assert.ok(data.every((p) => p.user_id === A));
});

console.log('Checkout (crear_pedido)');
await caso('sin sesión no se puede comprar', async () => {
  assert.ok((await anon.rpc('crear_pedido', { p_items: [{ producto_id: prueba.id, cantidad: 1 }] })).error);
});
await caso('compra válida: total con precio real y stock descontado', async () => {
  const { data: id, error } = await comprar(c1, [{ producto_id: prueba.id, cantidad: 2 }]);
  assert.ifError(error);
  const { data: p } = await c1.from('pedidos').select('subtotal, total, user_id').eq('id', id).single();
  assert.equal(Number(p.total), 200);
  assert.equal(p.user_id, A);
  assert.equal(await stockActual(prueba.id), 1);
});
await caso('un precio mandado por el cliente se ignora', async () => {
  const { data: id, error } = await comprar(c2, [{ producto_id: prueba.id, cantidad: 1, precio: 1, precio_unitario: 1 }]);
  assert.ifError(error);
  const { data: p } = await c2.from('pedidos').select('total').eq('id', id).single();
  assert.equal(Number(p.total), 100);
});
await caso('stock insuficiente: falla y no deja pedido ni descuenta nada', async () => {
  const antes = (await admin.from('pedidos').select('*', { count: 'exact', head: true })).count;
  const { error } = await comprar(c1, [{ producto_id: prueba.id, cantidad: 1 }]);
  assert.ok(error, 'debía fallar: no queda stock');
  assert.equal(await stockActual(prueba.id), 0);
  assert.equal((await admin.from('pedidos').select('*', { count: 'exact', head: true })).count, antes);
});
await caso('atomicidad: si el 2º renglón falla, el 1º no se descuenta', async () => {
  const { data: otro } = await admin.from('productos').insert({ nombre: `TEST2-${Date.now()}`, precio: 10, stock: 5, categoria_id: cat.id }).select().single();
  const { error } = await comprar(c1, [{ producto_id: otro.id, cantidad: 2 }, { producto_id: prueba.id, cantidad: 1 }]);
  const stock = await stockActual(otro.id);
  await admin.from('productos').delete().eq('id', otro.id);
  assert.ok(error);
  assert.equal(stock, 5);
});
await caso('cantidades inválidas (0, negativa, no numérica) se rechazan', async () => {
  for (const cantidad of [0, -1, 'abc', 101]) {
    const { error } = await comprar(c1, [{ producto_id: prueba.id, cantidad }]);
    assert.ok(error, `cantidad ${cantidad} debía fallar`);
  }
});
await caso('descuento válido se aplica; inválido o bajo el mínimo falla', async () => {
  await admin.from('productos').update({ stock: 10 }).eq('id', prueba.id);
  const ok = await comprar(c1, [{ producto_id: prueba.id, cantidad: 1 }], 'bienvenida10');
  assert.ifError(ok.error);
  const { data: p } = await c1.from('pedidos').select('total, descuento').eq('id', ok.data).single();
  assert.equal(Number(p.total), 90);
  assert.ok((await comprar(c1, [{ producto_id: prueba.id, cantidad: 1 }], 'NOEXISTE')).error);
  const { data: taza } = await admin.from('productos').select('id').eq('nombre', 'Taza').single();
  const bajoMinimo = await comprar(c1, [{ producto_id: taza.id, cantidad: 1 }], 'VERANO20');
  assert.ok(bajoMinimo.error, 'VERANO20 exige subtotal mínimo de 100');
});
await caso('un producto fuera de vigencia no se puede comprar', async () => {
  const { data: v } = await admin.from('productos').select('id').like('nombre', 'Bufanda%').single();
  assert.ok((await comprar(c1, [{ producto_id: v.id, cantidad: 1 }])).error);
});
await caso('compras simultáneas de la última unidad: solo una gana', async () => {
  await admin.from('productos').update({ stock: 1 }).eq('id', prueba.id);
  const r = await Promise.all([comprar(c1, [{ producto_id: prueba.id, cantidad: 1 }]), comprar(c2, [{ producto_id: prueba.id, cantidad: 1 }])]);
  assert.equal(r.filter((x) => !x.error).length, 1);
  assert.equal(await stockActual(prueba.id), 0);
});

console.log('Administración');
await caso('el admin puede crear, editar y borrar productos y descuentos', async () => {
  const { data: p, error } = await adm.from('productos').insert({ nombre: `TEST3-${Date.now()}`, precio: 5, stock: 1, categoria_id: cat.id }).select().single();
  assert.ifError(error);
  assert.ifError((await adm.from('productos').update({ precio: 6 }).eq('id', p.id)).error);
  assert.ifError((await adm.from('productos').delete().eq('id', p.id)).error);
  assert.ok(((await adm.from('descuentos').select('*')).data ?? []).length > 0);
});
await caso('el admin ve pedidos de varios clientes y cambia estados', async () => {
  const { data } = await adm.from('pedidos').select('id, user_id, estado').limit(200);
  assert.ok(new Set(data.map((p) => p.user_id)).size >= 2);
  assert.ifError((await adm.from('pedidos').update({ estado: data[0].estado }).eq('id', data[0].id)).error);
});
await caso('la vista resumen respeta RLS', async () => {
  const { data } = await c1.from('resumen_pedidos_por_estado').select('cantidad');
  const suma = data.reduce((n, r) => n + r.cantidad, 0);
  assert.equal(suma, (await admin.from('pedidos').select('*', { count: 'exact', head: true }).eq('user_id', A)).count);
});

// Limpieza de lo creado por las pruebas.
if (pedidosCreados.length) await admin.from('pedidos').delete().in('id', pedidosCreados);
await admin.from('productos').delete().eq('id', prueba.id);

console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(fallos ? 1 : 0);
