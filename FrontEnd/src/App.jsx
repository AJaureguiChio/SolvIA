import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import Layout from './components/Layout.jsx';
import { Cargando, Titulo, Vacio } from './components/comunes.jsx';
import Cuenta from './pages/Cuenta.jsx';
import Cuentas from './pages/Cuentas.jsx';
import Deudor from './pages/Deudor.jsx';
import Deudores from './pages/Deudores.jsx';
import Login from './pages/Login.jsx';
import Panel from './pages/Panel.jsx';
import RegistrarPago from './pages/RegistrarPago.jsx';
import { SesionProvider, useSesion } from './sesion/SesionContext.jsx';

function Protegida({ roles, children }) {
  const { estado, usuario } = useSesion();
  const location = useLocation();

  if (estado === 'cargando') {
    return (
      <main className="page">
        <Cargando />
      </main>
    );
  }
  if (estado !== 'listo') return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  if (roles && !roles.includes(usuario.rol)) return <SinPermiso />;
  return children;
}

function SinPermiso() {
  return (
    <>
      <Titulo titulo="Sin permiso" />
      <Vacio titulo="Esta pantalla no está disponible para tu rol" />
    </>
  );
}

function NoEncontrada() {
  return (
    <>
      <Titulo titulo="Página no encontrada" />
      <Vacio titulo="La dirección no existe" />
    </>
  );
}

export default function App() {
  return (
    <SesionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Protegida>
                <Layout />
              </Protegida>
            }
          >
            <Route index element={<Panel />} />
            <Route path="deudores" element={<Deudores />} />
            <Route
              path="deudores/nuevo"
              element={
                <Protegida roles={['administrador']}>
                  <Deudor />
                </Protegida>
              }
            />
            <Route path="deudores/:id" element={<Deudor />} />
            <Route path="cuentas" element={<Cuentas />} />
            <Route path="cuentas/:id" element={<Cuenta />} />
            <Route
              path="cuentas/:id/pago"
              element={
                <Protegida roles={['gestor']}>
                  <RegistrarPago />
                </Protegida>
              }
            />
            <Route path="*" element={<NoEncontrada />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SesionProvider>
  );
}
