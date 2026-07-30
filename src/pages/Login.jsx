import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import "../styles/Login.css";

function formatLogin(value) {
  const raw = value.trim();

  if (raw.includes("@")) return raw.toLowerCase();

  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!/^[A-Z]{2}\d{0,5}$/.test(cleaned)) {
    return value;
  }

  if (cleaned.length <= 2) return cleaned;

  const uf = cleaned.slice(0, 2);
  const nums = cleaned.slice(2);

  if (nums.length <= 2) return `${uf} ${nums}`;
  return `${uf} ${nums.slice(0, 2)}.${nums.slice(2, 5)}`;
}

export default function Login() {
  const navigate = useNavigate();

  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [lembrarMe, setLembrarMe] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [solicitacao, setSolicitacao] = useState({
    oab: "",
    numero: "",
    email: "",
  });
  const [enviandoSolicitacao, setEnviandoSolicitacao] = useState(false);
  const [mensagemSolicitacao, setMensagemSolicitacao] = useState("");

  function handleLoginChange(e) {
    const value = e.target.value;

    if (value.includes("@")) {
      setLogin(value.toLowerCase());
      return;
    }

    setLogin(formatLogin(value));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      const response = await api.post("/auth/login", {
        login: login.trim(),
        senha,
      });

      const token = response.data?.access_token;
      const role = response.data?.role || (login.trim().toLowerCase() === "admin94@gmail.com" ? "admin" : "advogado");

      if (!token) {
        throw new Error("Token não recebido.");
      }

      const storage = lembrarMe ? localStorage : sessionStorage;
      storage.setItem("juriprazo_token", token);
      storage.setItem("juriprazo_role", role);

      navigate(role === "admin" ? "/admin" : "/dashboard", { replace: true });
    } catch (error) {
      const status = error?.response?.status;

      if (status === 401) {
        setErro("Credenciais inválidas. Verifique os dados e tente novamente.");
      } else {
        setErro("Não foi possível conectar ao servidor. Tente novamente.");
      }
    } finally {
      setCarregando(false);
    }
  }

  async function handlePrimeiroAcesso(e) {
    e.preventDefault();
    setMensagemSolicitacao("");
    setEnviandoSolicitacao(true);

    try {
      await api.post("/auth/solicitar-acesso", {
        oab: solicitacao.oab,
        numero: solicitacao.numero,
        email: solicitacao.email,
      });

      setMensagemSolicitacao("Solicitação enviada com sucesso. Aguarde a aprovação do admin.");
      setSolicitacao({ oab: "", numero: "", email: "" });
    } catch (error) {
      const msg = error?.response?.data?.detail;
      setMensagemSolicitacao(msg || "A solicitação não pôde ser enviada agora.");
    } finally {
      setEnviandoSolicitacao(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="hero-badge">
          <span>JuriPrazo</span>
        </div>

        <h2>Bem - vindo ao sistema de prazos juridicos!</h2>
        <p>
          Acesse o sistema com seu login autorizado. O advogado entra apenas
          após liberação do admin, clique em "Primeiro acesso" caso seja novo!
        </p>
        <h3>Aqui você encontra:</h3>
        <div className="hero-features">
          <div className="hero-feature">
            <span></span>
            <span>Prazos em dia</span>
          </div>
          <div className="hero-feature">
            <span></span>
            <span>Cliente satisfeito</span>
          </div>
          <div className="hero-feature">
            <span></span>
            <span>Organização</span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <h2>Entrar</h2>
          <p className="login-subtitle">Acesse sua conta para continuar.</p>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="field">
              <label htmlFor="login">Número da OAB ou e-mail</label>
              <input
                id="login"
                type="text"
                value={login}
                onChange={handleLoginChange}
                placeholder="Ex: PB 12.345 ou email@gmail.com"
                autoComplete="username"
                spellCheck="false"
              />
            </div>

            <div className="field">
              <label htmlFor="senha">Senha</label>
              <div className="password-box">
                <input
                  id="senha"
                  type={mostrarSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setMostrarSenha((prev) => !prev)}
                >
                  {mostrarSenha ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            <div className="options-row">
              <label className="remember">
                <input
                  type="checkbox"
                  checked={lembrarMe}
                  onChange={(e) => setLembrarMe(e.target.checked)}
                />
                <span>Lembrar-me</span>
              </label>

              <Link to="/recuperar-senha" className="forgot-link">
                Esqueci minha senha
              </Link>
            </div>

            {erro && <div className="error-box">{erro}</div>}

            <button type="submit" className="login-button" disabled={carregando}>
              {carregando ? "Entrando..." : "Entrar"}
            </button>

            <button
              type="button"
              className="first-access-link"
              onClick={() => setModalAberto(true)}
            >
              Primeiro acesso?
            </button>
          </form>
        </div>
      </section>

      {modalAberto && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Solicitação de primeiro acesso</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModalAberto(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handlePrimeiroAcesso} className="modal-form">
              <label>
                OAB
                <input
                  type="text"
                  value={solicitacao.oab}
                  onChange={(e) =>
                    setSolicitacao((prev) => ({ ...prev, oab: e.target.value }))
                  }
                  placeholder="Ex: PB 12.345"
                  required
                />
              </label>

              <label>
                Número
                <input
                  type="text"
                  value={solicitacao.numero}
                  onChange={(e) =>
                    setSolicitacao((prev) => ({ ...prev, numero: e.target.value }))
                  }
                  placeholder="Ex: 99999-9999"
                  required
                />
              </label>

              <label>
                E-mail
                <input
                  type="email"
                  value={solicitacao.email}
                  onChange={(e) =>
                    setSolicitacao((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="email@exemplo.com"
                  required
                />
              </label>

              {mensagemSolicitacao && (
  <div
    className={
      mensagemSolicitacao.toLowerCase().includes("sucesso")
        ? "success-box"
        : "error-box"
    }
  >
    {mensagemSolicitacao}
  </div>
)}

              <button
                type="submit"
                className="login-button"
                disabled={enviandoSolicitacao}
              >
                {enviandoSolicitacao ? "Enviando..." : "Enviar solicitação"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}