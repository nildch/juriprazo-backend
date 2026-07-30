import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import RecuperarSenha from "./pages/RecuperarSenha.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import Processos from "./pages/Processos.jsx";
import ProcessoDetalhe from "./pages/ProcessoDetalhe.jsx";
import Prazos from "./pages/Prazos.jsx";

function PrivateRoute({ children, admin = false }) {
  const token =
    localStorage.getItem("juriprazo_token") ||
    sessionStorage.getItem("juriprazo_token");

  const role =
    localStorage.getItem("juriprazo_role") ||
    sessionStorage.getItem("juriprazo_role");

  if (!token) return <Navigate to="/login" replace />;
  if (admin && role !== "admin") return <Navigate to="/dashboard" replace />;

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/recuperar-senha" element={<RecuperarSenha />} />

        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <PrivateRoute admin>
              <AdminDashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/processos"
          element={
            <PrivateRoute>
              <Processos />
            </PrivateRoute>
          }
        />

        <Route
          path="/processos/:id"
          element={
            <PrivateRoute>
              <ProcessoDetalhe />
            </PrivateRoute>
          }
        />

        <Route
          path="/prazos"
          element={
            <PrivateRoute>
              <Prazos />
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}