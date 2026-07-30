import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import AppShell from "../components/AppShell";
import "../styles/CrudPages.css";
import "../styles/modais.css";

function normalizeArray(data) {
  if (
    Array.isArray(data) &&
    data.length === 2 &&
    Array.isArray(data[0]) &&
    typeof data[1] === "number"
  ) {
    return data[0];
  }
  if (Array.isArray(data)) return data;
  return [];
}

function normalizarTexto(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatDateBR(value) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function gerarIcs(prazo, processo) {
  const data = String(prazo.data_prazo || "").replaceAll("-", "");
  const hoje = new Date();
  const stamp = hoje.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const conteudo = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JuriPrazo//PT-BR//EN",
    "BEGIN:VEVENT",
    `UID:${prazo.id}@juriprazo`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${data}`,
    `SUMMARY:${prazo.descricao}`,
    `DESCRIPTION:Processo ${processo?.numero_cnj || "-"}\\nPrioridade: ${prazo.prioridade || "media"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([conteudo], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `prazo-${prazo.id}.ics`;
  a.click();

  URL.revokeObjectURL(url);
}

export default function Prazos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const processoIdInicial = searchParams.get("processo_id") || "";

  const [prazos, setPrazos] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [modalAberto, setModalAberto] = useState(Boolean(processoIdInicial));
  const [form, setForm] = useState({
    processo_id: processoIdInicial,
    descricao: "",
    data_inicio: "",
    dias_uteis: 5,
    prioridade: "media",
  });

  async function carregarDados() {
    try {
      setErro("");
      const [resPrazos, resProcessos, resClientes] = await Promise.all([
        api.get("/prazos"),
        api.get("/processos"),
        api.get("/clientes"),
      ]);

      setPrazos(normalizeArray(resPrazos.data));
      setProcessos(normalizeArray(resProcessos.data));
      setClientes(normalizeArray(resClientes.data));
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
      setErro("Não foi possível carregar os prazos.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregarDados();
  }, []);

  const processosMap = useMemo(() => {
    const map = new Map();
    processos.forEach((p) => map.set(p.id, p));
    return map;
  }, [processos]);

  const clientesMap = useMemo(() => {
    const map = new Map();
    clientes.forEach((c) => map.set(c.id, c));
    return map;
  }, [clientes]);

  const prazosOrdenados = useMemo(() => {
    const base = [...prazos].sort((a, b) => {
      const da = new Date(a.data_prazo || 0).getTime();
      const db = new Date(b.data_prazo || 0).getTime();
      return da - db;
    });

    const termo = busca.trim().toLowerCase();

    return base.filter((prazo) => {
      const statusNormalizado = normalizarTexto(prazo.status);

      if (filtroStatus !== "todos" && statusNormalizado !== filtroStatus) {
        return false;
      }

      if (!termo) return true;

      const processo = processosMap.get(prazo.processo_id);
      const cliente = processo ? clientesMap.get(processo.cliente_id) : null;

      return [
        prazo.descricao,
        prazo.status,
        prazo.prioridade,
        processo?.numero_cnj,
        cliente?.nome,
      ]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(termo));
    });
  }, [prazos, busca, filtroStatus, processosMap, clientesMap]);

  function abrirNovo() {
    if (processos.length === 0) {
      setErro("Cadastre um processo antes de criar um prazo.");
      return;
    }

    setSucesso("");
    setErro("");
    setForm({
      processo_id: processoIdInicial || processos[0]?.id || "",
      descricao: "",
      data_inicio: "",
      dias_uteis: 5,
      prioridade: "media",
    });
    setModalAberto(true);
  }

  async function salvarPrazo(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    try {
      await api.post("/prazos", {
        processo_id: form.processo_id,
        descricao: form.descricao,
        data_inicio: form.data_inicio,
        dias_uteis: Number(form.dias_uteis),
        prioridade: form.prioridade,
      });

      setSucesso("Prazo cadastrado com sucesso!");
      setModalAberto(false);
      setForm({
        processo_id: processoIdInicial || "",
        descricao: "",
        data_inicio: "",
        dias_uteis: 5,
        prioridade: "media",
      });

      await carregarDados();
    } catch (error) {
      const msg = error?.response?.data?.detail;
      setErro(msg || "Não foi possível salvar o prazo.");
    }
  }

  async function marcarConcluido(id) {
    try {
      await api.patch(`/prazos/${id}/status`, { status: "concluido" });
      setSucesso("Prazo concluído com sucesso!");
      await carregarDados();
    } catch (error) {
      const msg = error?.response?.data?.detail;
      setErro(msg || "Não foi possível atualizar o status.");
    }
  }

  async function excluirPrazo(id) {
    const confirmar = window.confirm("Deseja excluir este prazo?");
    if (!confirmar) return;

    try {
      await api.delete(`/prazos/${id}`);
      await carregarDados();
    } catch (error) {
      const msg = error?.response?.data?.detail;
      setErro(msg || "Não foi possível excluir o prazo.");
    }
  }

  function sair() {
    localStorage.removeItem("juriprazo_token");
    localStorage.removeItem("juriprazo_role");
    sessionStorage.removeItem("juriprazo_token");
    sessionStorage.removeItem("juriprazo_role");
    navigate("/login", { replace: true });
  }

  if (carregando) return <div className="crud-loading">Carregando prazos...</div>;

  return (
    <AppShell
      title="Agenda"
      subtitle="Confira abaixo seus prazos pendentes ou concluídos."
      actions={
        <>
          <button onClick={() => navigate("/dashboard")}>Voltar</button>
          <button onClick={abrirNovo} disabled={processos.length === 0}>Adcionar um novo prazo</button>
          <button className="logout-button" onClick={sair}>Sair</button>
        </>
      }
    >
      {processos.length === 0 && (
        <div className="crud-alert error">Cadastre um processo antes de criar um prazo.</div>
      )}

      {(erro || sucesso) && (
        <div className={erro ? "crud-alert error" : "crud-alert success"}>
          {erro || sucesso}
        </div>
      )}

      <section className="crud-toolbar">
        <input
          type="text"
          placeholder="Buscar por descrição, processo ou cliente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="pendente">Pendentes</option>
          <option value="concluido">Concluídos</option>
        </select>

        <span>{prazosOrdenados.length} prazo(s)</span>
      </section>

      {prazosOrdenados.length === 0 ? (
        <div className="empty-box">Nenhum prazo encontrado.</div>
      ) : (
        <div className="list-grid">
          {prazosOrdenados.map((prazo) => {
            const processo = processosMap.get(prazo.processo_id);
            const cliente = processo ? clientesMap.get(processo.cliente_id) : null;
            const statusNormalizado = normalizarTexto(prazo.status);
            const statusLabel = statusNormalizado === "concluido" ? "Concluído" : "Pendente";

            return (
              <article className="list-card" key={prazo.id}>
                <div className="list-card-main">
                  <div className="list-card-title">
                    <strong>{prazo.descricao}</strong>
                    <span className={`status-pill ${statusNormalizado === "concluido" ? "done" : ""}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <p><b>Processo:</b> {processo?.numero_cnj || "-"}</p>
                  <p><b>Cliente:</b> {cliente?.nome || "-"}</p>
                  <p><b>Vencimento:</b> {formatDateBR(prazo.data_prazo)}</p>
                  <p><b>Prioridade:</b> {String(prazo.prioridade || "media")}</p>
                </div>

                <div className="list-card-actions">
                  <button onClick={() => marcarConcluido(prazo.id)}>Concluir</button>
                  <button onClick={() => gerarIcs(prazo, processo)}>Exportar agenda</button>
                  <button onClick={() => excluirPrazo(prazo.id)}>Excluir</button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modalAberto && (
        <div className="modal-overlay">
          <div className="modal-box wide-modal">
            <div className="modal-header">
              <h3>Novo prazo</h3>
              <button type="button" className="modal-close" onClick={() => setModalAberto(false)}>×</button>
            </div>

            <form className="modal-form" onSubmit={salvarPrazo}>
              <label>
                Processo
                <select
                  value={form.processo_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, processo_id: e.target.value }))}
                  required
                  disabled={processos.length === 0}
                >
                  <option value="">{processos.length === 0 ? "Nenhum processo cadastrado" : "Selecione"}</option>
                  {processos.map((processo) => (
                    <option key={processo.id} value={processo.id}>
                      {processo.numero_cnj}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Descrição do prazo
                <input
                  type="text"
                  value={form.descricao}
                  onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Ex: Contestação"
                  required
                />
              </label>

              <div className="form-two-columns">
                <label>
                  Data inicial
                  <input
                    type="date"
                    value={form.data_inicio}
                    onChange={(e) => setForm((prev) => ({ ...prev, data_inicio: e.target.value }))}
                    required
                  />
                </label>

                <label>
                  Dias úteis
                  <input
                    type="number"
                    min="1"
                    value={form.dias_uteis}
                    onChange={(e) => setForm((prev) => ({ ...prev, dias_uteis: e.target.value }))}
                    required
                  />
                </label>
              </div>

              <label>
                Prioridade
                <select
                  value={form.prioridade}
                  onChange={(e) => setForm((prev) => ({ ...prev, prioridade: e.target.value }))}
                >
                  <option value="baixa">baixa</option>
                  <option value="media">media</option>
                  <option value="alta">alta</option>
                </select>
              </label>

              <button type="submit" className="login-button">
                Salvar prazo
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
