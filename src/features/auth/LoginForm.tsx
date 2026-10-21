import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { NotaClase } from '../../components/NotaClase';

export function LoginForm() {
  const { user } = useAuth();
  const destino = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (user) return <Navigate to={destino} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return; // evita el doble submit
    setEnviando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // Mensaje genérico a propósito: no revela si el email existe.
    if (error) setError('Email o contraseña incorrectos.');
    setEnviando(false);
  };

  return (
    <form className="tarjeta formulario" onSubmit={onSubmit}>
      <h1>Ingresar</h1>
      <label>Email <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
      <label>Contraseña <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" disabled={enviando}>{enviando ? 'Ingresando…' : 'Ingresar'}</button>
      <NotaClase titulo="usuarios de demo">
        Datos ficticios de la demo (contraseña <code>demo1234</code>). Tocá uno para completar el formulario:
        <span className="fila-demo">
          <button type="button" className="secundario chico" onClick={() => { setEmail('admin@demo.test'); setPassword('demo1234'); }}>Admin demo</button>
          <button type="button" className="secundario chico" onClick={() => { setEmail('cliente1@demo.test'); setPassword('demo1234'); }}>Cliente demo</button>
        </span>
      </NotaClase>
      <p>¿No tenés cuenta? <Link to="/registro">Registrate</Link></p>
    </form>
  );
}
