// Carga categorías, productos, descuentos, usuarios y algunos pedidos ficticios.
// Idempotente: no duplica lo que ya existe.
import { admin, USUARIOS_DEMO, asegurarUsuario, conSesion, PASSWORD_DEMO } from './_clientes.mjs';

const CATALOGO = {
  Ropa: [['Camisa', 25, 40], ['Pantalón', 40, 30], ['Campera', 65, 20]],
  Accesorios: [['Mochila', 45, 25], ['Gorra', 12, 60], ['Cinturón', 18, 35]],
  Calzado: [['Zapatillas', 80, 30], ['Botas', 95, 15], ['Sandalias', 30, 40]],
  Tecnología: [['Auriculares', 55, 25], ['Cargador USB-C', 15, 80], ['Mouse inalámbrico', 22, 45]],
  Hogar: [['Lámpara LED', 20, 35], ['Taza', 8, 100], ['Almohadón', 14, 50]],
};

for (const [nombre, productos] of Object.entries(CATALOGO)) {
  await admin.from('categorias').upsert({ nombre, descripcion: `Categoría ${nombre}` }, { onConflict: 'nombre' });
  const { data: cat } = await admin.from('categorias').select('id').eq('nombre', nombre).single();
  for (const [prod, precio, stock] of productos) {
    const { data: existe } = await admin.from('productos').select('id').eq('nombre', prod).maybeSingle();
    if (!existe) {
      const { error } = await admin.from('productos').insert({ nombre: prod, precio, stock, categoria_id: cat.id });
      if (error) throw error;
    }
  }
}
// Un producto vencido, para mostrar la vigencia en el catálogo.
const { data: ropa } = await admin.from('categorias').select('id').eq('nombre', 'Ropa').single();
const { data: viejo } = await admin.from('productos').select('id').eq('nombre', 'Bufanda (fuera de temporada)').maybeSingle();
if (!viejo) await admin.from('productos').insert({
  nombre: 'Bufanda (fuera de temporada)', precio: 10, stock: 5, categoria_id: ropa.id, vigente_hasta: '2025-12-31',
});

await admin.from('descuentos').upsert([
  { codigo: 'BIENVENIDA10', porcentaje: 10, monto_minimo: 0 },
  { codigo: 'VERANO20', porcentaje: 20, monto_minimo: 100 },
], { onConflict: 'codigo' });

for (const u of USUARIOS_DEMO) await asegurarUsuario(u);

const { count } = await admin.from('pedidos').select('*', { count: 'exact', head: true });
if (!count) {
  const { data: prods } = await admin.from('productos').select('id').lte('vigente_desde', new Date().toISOString().slice(0, 10)).gte('vigente_hasta', new Date().toISOString().slice(0, 10)).limit(8);
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
console.log(`Listo. Admin: admin@demo.test / ${PASSWORD_DEMO} · Clientes: cliente1@demo.test, cliente2@demo.test`);
