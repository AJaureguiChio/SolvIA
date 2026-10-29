import { NavLink, Outlet } from 'react-router';
import { useSesion } from '../sesion/SesionContext.jsx';

export default function Layout() {
  const { usuario, cerrarSesion } = useSesion();
  const nombre = usuario.nombre || usuario.email;

  return (
    <>
      <header className="apphead">
        <NavLink to="/" className="logo">
          SolvIA
        </NavLink>
        <nav className="appnav" aria-label="Principal">
          <NavLink to="/" end>
            Panel
          </NavLink>
          <NavLink to="/deudores">Deudores</NavLink>
          <NavLink to="/cuentas">{usuario.rol === 'gestor' ? 'Mis cuentas' : 'Cuentas'}</NavLink>
          {usuario.rol === 'administrador' && <NavLink to="/usuarios">Usuarios</NavLink>}
        </nav>
        <div className="right">
          <span>
            {nombre} · {usuario.rol === 'administrador' ? 'Administrador' : 'Gestor'}
          </span>
          <NavLink to="/configuracion-facial" className="link">
            Mi rostro
          </NavLink>
          <span className="avatar" aria-hidden="true">
            {nombre.charAt(0).toUpperCase()}
          </span>
          <button type="button" className="btn" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
