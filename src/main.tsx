import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { configurado } from './lib/supabase';
import { precargarCatalogo } from './lib/catalogo';
import './index.css';

const raiz = createRoot(document.getElementById('root')!);

if (!configurado) {
  // Concepto · Las variables VITE_* se incorporan al COMPILAR. Si el hosting no las tenía
  // cuando se hizo el build, no hay con qué conectarse a Supabase y, sin este aviso,
  // la página quedaría en blanco sin explicación.
  raiz.render(
    <main>
      <section className="tarjeta" role="alert">
        <h1>Falta configurar Supabase</h1>
        <p>La aplicación se compiló sin <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.</p>
        <ol>
          <li>En tu hosting (por ejemplo Vercel): <em>Settings → Environment Variables</em>.</li>
          <li>Agregá las dos variables para el entorno de producción.</li>
          <li>Volvé a desplegar (<em>Redeploy</em>): se incorporan al compilar, no alcanza con guardarlas.</li>
        </ol>
        <p>En tu máquina, copiá <code>.env.example</code> a <code>.env</code> y completalo.</p>
      </section>
    </main>,
  );
} else {
  // Los pedidos del catálogo salen YA, antes de que React termine de arrancar.
  precargarCatalogo();
  raiz.render(<StrictMode><App /></StrictMode>);
}
