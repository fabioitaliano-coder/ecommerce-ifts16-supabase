import { CartPanel } from '../../components/CartPanel';

// En pantallas angostas el carrito no cabe al costado de la tienda: se muestra en su propia página.
export function Carrito() {
  return (
    <section>
      <h1>Carrito</h1>
      <CartPanel />
    </section>
  );
}
