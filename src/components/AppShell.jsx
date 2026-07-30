import { NavLink, useNavigate } from "react-router-dom";
import "./AppShell.css";

const navItems = [
  { to: "/dashboard", label: "Home", icon: "⌂" },
  { to: "/prazos", label: "Agenda", icon: "▦" },
  { to: "/processos", label: "Processos", icon: "▣" },
  { to: "/clientes", label: "Clientes", icon: "◌" },
];

export default function AppShell({ title, subtitle, actions, children }) {
  const navigate = useNavigate();

  function sair() {
    localStorage.removeItem("juriprazo_token");
    localStorage.removeItem("juriprazo_role");
    sessionStorage.removeItem("juriprazo_token");
    sessionStorage.removeItem("juriprazo_role");
    navigate("/login", { replace: true });
  }

  return (
    <div className="jp-shell">
      <aside className="jp-sidebar">
        <div className="jp-brand">
          <div className="jp-brand-mark">⚖</div>
          <div>
            <strong>JuriPrazo</strong>
            <span>Prazos sob controle.</span>
          </div>
        </div>

        <nav className="jp-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `jp-nav-link ${isActive ? "active" : ""}`
              }
            >
              <span className="jp-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="jp-user-card">
          <div className="jp-user-avatar">ADV</div>
          <div>
            <strong>Advogado</strong>
          </div>
        </div>

        <button className="jp-logout" onClick={sair}>
          Sair
        </button>
      </aside>

      <main className="jp-main">
        <header className="jp-topbar">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="jp-top-actions">{actions}</div>
        </header>

        <section className="jp-content">{children}</section>
      </main>
    </div>
  );
}