import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { NotaClase } from '../../components/NotaClase';

export function RegisterForm() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    // Concepto · Solo se manda el nombre. El rol NO se envía ni se lee de acá: el trigger
    // handle_new_user() crea el perfil como 'cliente' sin importar lo que mande el navegador.
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: nombre } } });
    if (error) {
      // 429 = límite de mails de Supabase Auth. Con el servicio de mails integrado son muy pocos por hora
      // para todo el proyecto, y cada alta con confirmación envía uno.
      setError(error.status === 429 || /rate limit/i.test(error.message)
        ? 'Se alcanzó el límite de mails de confirmación del proyecto. Probá en un rato, o ingresá con un usuario de demo.'
        : error.message);
    }
    else if (!data.session) setAviso('Te enviamos un email para confirmar la cuenta.');
    setEnviando(false);
  };

  return (
    <form className="tarjeta formulario" onSubmit={onSubmit}>
      <h1>Crear cuenta</h1>
      <label>Nombre <input value={nombre} onChange={(e) => setNombre(e.target.value)} required /></label>
      <label>Email <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
      <label>Contraseña (mínimo 8) <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" /></label>
      {error && <p role="alert" className="error">{error}</p>}
      {aviso && <p role="status">{aviso}</p>}
      <button type="submit" disabled={enviando}>{enviando ? 'Creando…' : 'Registrarme'}</button>
      <NotaClase titulo="registro y mails de confirmación">
        Registrarse crea el usuario en Supabase Auth y un trigger genera su perfil como <strong>cliente</strong> (el rol nunca viene del navegador).
        Si el proyecto exige confirmar el email, el servicio de mails integrado permite muy pocos envíos por hora: por eso puede aparecer el error <em>email rate limit exceeded</em>.
      </NotaClase>
      <p>¿Ya tenés cuenta? <Link to="/login">Ingresá</Link></p>
    </form>
  );
}
