import { Component, type ErrorInfo, type ReactNode } from 'react';

// Concepto · Sin un límite de errores, una falla al dibujar una pantalla deja la página en blanco.
// Este componente la reemplaza por un aviso con una salida.
export class LimiteDeErrores extends Component<{ children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };
  static getDerivedStateFromError() { return { fallo: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Error de pantalla:', error, info.componentStack); }
  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <section className="tarjeta" role="alert" style={{ maxWidth: 520, margin: '3rem auto' }}>
        <h1>No pudimos mostrar esta pantalla</h1>
        <p>Puede ser que la aplicación se haya actualizado mientras la tenías abierta. Recargá la página para traer la versión nueva.</p>
        <button onClick={() => location.reload()}>Recargar</button>
      </section>
    );
  }
}
