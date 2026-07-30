import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "../styles/Dashboard.css";
import "../styles/modais.css";
import "../styles/AdminDashboard.css";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [solicitacoes, setSolicitacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [modalAprovarAberto, setModalAprovarAberto] = useState(false);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState(null);
  const [nomeAdvogado, setNomeAdvogado] = useState("");
  const [senhaProvisoria, setSenhaProvisoria] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregarSolicitacoes() {
    try {
      setErro("");
      const response = await api.get("/admin/solicitacoes-acesso");
      setSolicitacoes(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      const status = error?.response?.status;

      if (status === 401 || status === 403) {
        localStorage.removeItem("juriprazo_token");
        localStorage.removeItem("juriprazo_role");
        sessionStorage.removeItem("juriprazo_token");
        sessionStorage.removeItem("juriprazo_role");
        navigate("/login", { replace: true });
        return;
      }

      setErro("Não foi possível carregar as solicitações.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregarSolicitacoes();
  }, []);

  const totalPendentes = useMemo(() => solicitacoes.length, [solicitacoes]);

  function abrirModalAprovar(item) {
    setSolicitacaoSelecionada(item);
    setNomeAdvogado("");
    setSenhaProvisoria("");
    setModalAprovarAberto(true);
  }

  async function rejeitarSolicitacao(id) {
    const confirmar = window.confirm("Deseja rejeitar esta solicitação?");
    if (!confirmar) return;

    try {
      await api.post(`/admin/solicitacoes-acesso/${id}/rejeitar`);
      await carregarSolicitacoes();
    } catch {
      setErro("Não foi possível rejeitar a solicitação.");
    }
  }

  async function aprovarSolicitacao(e) {
    e.preventDefault();
    if (!solicitacaoSelecionada) return;

    setSalvando(true);
    setErro("");

    try {
      const payload = {
        nome: nomeAdvogado,
      };

      if (senhaProvisoria.trim()) {
        payload.senha = senhaProvisoria.trim();
      }

      await api.post(
        `/admin/solicitacoes-acesso/${solicitacaoSelecionada.id}/aprovar`,
        payload
      );

      setModalAprovarAberto(false);
      setSolicitacaoSelecionada(null);
      setNomeAdvogado("");
      setSenhaProvisoria("");
      await carregarSolicitacoes();
    } catch (error) {
      const msg = error?.response?.data?.detail;
      setErro(msg || "Não foi possível aprovar a solicitação.");
    } finally {
      setSalvando(false);
    }
  }

  function sair() {
    localStorage.removeItem("juriprazo_token");
    localStorage.removeItem("juriprazo_role");
    sessionStorage.removeItem("juriprazo_token");
    sessionStorage.removeItem("juriprazo_role");
    navigate("/login", { replace: true });
  }

  if (carregando) {
    return <div className="dashboard-loading">Carregando dashboard do admin...</div>;
  }

  return (
    <div className="dashboard-page admin-page">
      <header className="dashboard-topbar">
        <div>
          <h1>Bem vinda Nielen!</h1>
          <p>Veja as solicitações pendentes abaixo.</p>
        </div>

        <div className="dashboard-actions">
          <button onClick={() => navigate("/dashboard")}>Voltar</button>
          <button onClick={sair}>Sair</button>
        </div>
      </header>

      {erro && <div className="dashboard-error">{erro}</div>}

      <section className="dashboard-cards">
        <article className="summary-card">
          <span>Solicitações pendentes</span>
          <strong>{totalPendentes}</strong>
        </article>

        <article className="summary-card">
          <span>Status</span>
          <strong>Online</strong>
        </article>

        <article className="summary-card">
          <span>Área Do</span>
          <strong>Admin</strong>
        </article>
      </section>

      <section className="dashboard-panel">
        <div className="panel-header">
          <h2>Solicitações de primeiro acesso</h2>
          <span>{solicitacoes.length} registros</span>
        </div>

        {solicitacoes.length === 0 ? (
          <p className="empty-state">Nenhuma solicitação pendente no momento.</p>
        ) : (
          <div className="admin-list">
            {solicitacoes.map((item) => (
              <article className="admin-request-card" key={item.id}>
                <div className="admin-request-info">
                  <div>
                    <strong>OAB</strong>
                    <p>{item.oab}</p>
                  </div>
                  <div>
                    <strong>Número</strong>
                    <p>{item.numero}</p>
                  </div>
                  <div>
                    <strong>E-mail</strong>
                    <p>{item.email}</p>
                  </div>
                  <div>
                    <strong>Solicitado em</strong>
                    <p>{new Date(item.criado_em).toLocaleString("pt-BR")}</p>
                  </div>
                </div>

                <div className="admin-request-actions">
                  <button
                    className="gold-button"
                    onClick={() => abrirModalAprovar(item)}
                  >
                    Aprovar
                  </button>
                  <button
                    className="dark-button"
                    onClick={() => rejeitarSolicitacao(item.id)}
                  >
                    Rejeitar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {modalAprovarAberto && (
        <div className="modal-overlay">
          <div className="modal-box admin-modal">
            <div className="modal-header">
              <h3>Aprovar solicitação</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModalAprovarAberto(false)}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={aprovarSolicitacao}>
              <label>
                Nome do advogado
                <input
                  type="text"
                  value={nomeAdvogado}
                  onChange={(e) => setNomeAdvogado(e.target.value)}
                  placeholder="Ex: Dr. João Silva"
                  required
                />
              </label>

              <label>
                Senha provisória
                <input
                  type="text"
                  value={senhaProvisoria}
                  onChange={(e) => setSenhaProvisoria(e.target.value)}
                  placeholder="Opcional — se vazio, o sistema gera uma senha forte"
                />
              </label>

              {solicitacaoSelecionada && (
                <div className="request-preview">
                  <p><strong>OAB:</strong> {solicitacaoSelecionada.oab}</p>
                  <p><strong>E-mail:</strong> {solicitacaoSelecionada.email}</p>
                </div>
              )}

              <button type="submit" className="login-button" disabled={salvando}>
                {salvando ? "Aprovando..." : "Confirmar aprovação"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}