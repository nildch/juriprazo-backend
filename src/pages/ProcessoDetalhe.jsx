import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

function formatCnj(value) {
  const digits = value.replace(/\D/g, "").slice(0, 20);

  const p1 = digits.slice(0, 7);
  const p2 = digits.slice(7, 9);
  const p3 = digits.slice(9, 13);
  const p4 = digits.slice(13, 14);
  const p5 = digits.slice(14, 16);
  const p6 = digits.slice(16, 20);

  let out = p1;
  if (digits.length > 7) out += `-${p2}`;
  if (digits.length > 9) out += `.${p3}`;
  if (digits.length > 13) out += `.${p4}`;
  if (digits.length > 14) out += `.${p5}`;
  if (digits.length > 16) out += `.${p6}`;

  return out;
}

function formatDateBR(value) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatDateTimeBR(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

const CNJ_REGEX = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

export default function ProcessoDetalhe() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [processo, setProcesso] = useState(null);
  const [prazos, setPrazos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [editando, setEditando] = useState(false);
  const [modalPrazoAberto, setModalPrazoAberto] = useState(false);

  const [formProcesso, setFormProcesso] = useState({
    cliente_id: "",
    numero_cnj: "",
    vara: "",
    comarca: "",
    tribunal: "",
  });

  const [formPrazo, setFormPrazo] = useState({
    descricao: "",
    data_inicio: "",
    dias_uteis: 5,
    prioridade: "media",
  });

  async function carregarDados() {
    try {
      setErro("");

      const [resProcesso, resPrazos, resClientes] = await Promise.all([
        api.get(`/processos/${id}`),
        api.get("/prazos"),
        api.get("/clientes"),
      ]);

      const processoData = resProcesso.data || null;
      setProcesso(processoData);

      setFormProcesso({
        cliente_id: processoData?.cliente_id || "",
        numero_cnj: processoData?.numero_cnj || "",
        vara: processoData?.vara || "",
        comarca: processoData?.comarca || "",
        tribunal: processoData?.tribunal || "",
      });

      const prazosArray = normalizeArray(resPrazos.data);
      setPrazos(prazosArray.filter((p) => p.processo_id === id));

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

      if (status === 404) {
        setErro("Processo não encontrado.");
        setProcesso(null);
        return;
      }

      setErro("Não foi possível carregar os detalhes do processo.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    void carregarDados();
  }, [id]);

  const clienteAtual = useMemo(() => {
    return clientes.find((cliente) => cliente.id === formProcesso.cliente_id);
  }, [clientes, formProcesso.cliente_id]);

  const prazosOrdenados = useMemo(() => {
    return [...prazos].sort((a, b) => {
      const da = new Date(a.data_prazo || 0).getTime();
      const db = new Date(b.data_prazo || 0).getTime();
      return da - db;
    });
  }, [prazos]);

  async function salvarProcesso(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    if (!formProcesso.numero_cnj.trim() || !formProcesso.cliente_id) {
      setErro("Número do processo e cliente são obrigatórios.");
      return;
    }

    if (!CNJ_REGEX.test(formProcesso.numero_cnj.trim())) {
      setErro("O número do processo precisa seguir o padrão CNJ.");
      return;
    }

    try {
      await api.put(`/processos/${id}`, {
        cliente_id: formProcesso.cliente_id,
        numero_cnj: formProcesso.numero_cnj.trim(),
        vara: formProcesso.vara.trim(),
        comarca: formProcesso.comarca.trim(),
        tribunal: formProcesso.tribunal.trim(),
      });

      setSucesso("Processo atualizado com sucesso!");
      setEditando(false);
      await carregarDados();
    } catch (error) {
      const msg = error?.response?.data?.detail;
      setErro(msg || "Não foi possível atualizar o processo.");
    }
  }

  async function salvarPrazo(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    try {
      await api.post("/prazos", {
        processo_id: id,
        descricao: formPrazo.descricao.trim(),
        data_inicio: formPrazo.data_inicio,
        dias_uteis: Number(formPrazo.dias_uteis),
        prioridade: formPrazo.prioridade,
      });

      setSucesso("Prazo cadastrado com sucesso!");
      setModalPrazoAberto(false);
      setFormPrazo({
        descricao: "",
        data_inicio: "",
        dias_uteis: 5,
        prioridade: "media",
      });
      await carregarDados();
    } catch (error) {
      const msg = error?.response?.data?.detail;
      setErro(msg || "Não foi possível cadastrar o prazo.");
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
    return <div className="crud-loading">Carregando detalhes do processo...</div>;
  }

  if (!processo) {
    return (
      <AppShell
        title="Detalhes do Processo"
        subtitle="Informações do processo selecionado."
        actions={
          <>
            <button onClick={() => navigate("/processos")}>Voltar</button>
            <button className="logout-button" onClick={sair}>
              Sair
            </button>
          </>
        }
      >
        <div className="crud-page">
          {erro && <div className="crud-alert error">{erro}</div>}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Detalhes do Processo"
      subtitle="Informações do processo e prazos vinculados."
      actions={
        <>
          <button onClick={() => navigate("/processos")}>Voltar</button>
          <button onClick={() => navigate("/prazos?processo_id=" + id)}>
            Ir para Agenda
          </button>
          <button onClick={() => setModalPrazoAberto(true)}>Novo prazo</button>
          <button className="logout-button" onClick={sair}>
            Sair
          </button>
        </>
      }
    >
      <div className="crud-page">
        {(erro || sucesso) && (
          <div className={erro ? "crud-alert error" : "crud-alert success"}>
            {erro || sucesso}
          </div>
        )}

        <section className="detail-grid">
          <article className="detail-card">
            <div className="detail-card-header">
              <h2>Dados cadastrais</h2>
              <button onClick={() => setEditando((prev) => !prev)}>
                {editando ? "Cancelar edição" : "Editar processo"}
              </button>
            </div>

            {editando ? (
              <form className="modal-form" onSubmit={salvarProcesso}>
                <label>
                  Cliente
                  <select
                    value={formProcesso.cliente_id}
                    onChange={(e) =>
                      setFormProcesso((prev) => ({
                        ...prev,
                        cliente_id: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Selecione</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome} {cliente.email ? `- ${cliente.email}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Número do processo (CNJ)
                  <input
                    type="text"
                    value={formProcesso.numero_cnj}
                    onChange={(e) =>
                      setFormProcesso((prev) => ({
                        ...prev,
                        numero_cnj: formatCnj(e.target.value),
                      }))
                    }
                    placeholder="0000000-00.0000.0.00.0000"
                    maxLength={25}
                    required
                  />
                </label>

                <div className="form-two-columns">
                  <label>
                    Tribunal
                    <input
                      type="text"
                      value={formProcesso.tribunal}
                      onChange={(e) =>
                        setFormProcesso((prev) => ({
                          ...prev,
                          tribunal: e.target.value,
                        }))
                      }
                      placeholder="TJPB, TST, TRF1..."
                    />
                  </label>

                  <label>
                    Vara
                    <input
                      type="text"
                      value={formProcesso.vara}
                      onChange={(e) =>
                        setFormProcesso((prev) => ({
                          ...prev,
                          vara: e.target.value,
                        }))
                      }
                      placeholder="Ex: 1ª Vara Civil"
                    />
                  </label>
                </div>

                <label>
                  Comarca
                  <input
                    type="text"
                    value={formProcesso.comarca}
                    onChange={(e) =>
                      setFormProcesso((prev) => ({
                        ...prev,
                        comarca: e.target.value,
                      }))
                    }
                    placeholder="Ex: João Pessoa"
                  />
                </label>

                <button type="submit" className="login-button">
                  Salvar alterações
                </button>
              </form>
            ) : (
              <div className="detail-info">
                <p><b>Número do processo:</b> {processo.numero_cnj || "-"}</p>
                <p><b>Cliente:</b> {clienteAtual?.nome || "—"}</p>
                <p><b>Tribunal:</b> {processo.tribunal || "-"}</p>
                <p><b>Vara:</b> {processo.vara || "-"}</p>
                <p><b>Comarca:</b> {processo.comarca || "-"}</p>
                <p><b>Status:</b> {processo.status || "-"}</p>
                <p>
                  <b>Criado em:</b>{" "}
                  {processo.criado_em ? formatDateTimeBR(processo.criado_em) : "-"}
                </p>
              </div>
            )}
          </article>

          <article className="detail-card">
            <div className="detail-card-header">
              <h2>Linha do tempo dos prazos</h2>
              <span>{prazosOrdenados.length} prazo(s)</span>
            </div>

            {prazosOrdenados.length === 0 ? (
              <div className="empty-box">Nenhum prazo vinculado a este processo.</div>
            ) : (
              <div className="timeline">
                {prazosOrdenados.map((prazo) => (
                  <div className="timeline-item" key={prazo.id}>
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <strong>{prazo.descricao}</strong>
                      <p><b>Vencimento:</b> {formatDateBR(prazo.data_prazo)}</p>
                      <p><b>Status:</b> {String(prazo.status || "pendente")}</p>
                      <p><b>Prioridade:</b> {String(prazo.prioridade || "media")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        {modalPrazoAberto && (
          <div className="modal-overlay">
            <div className="modal-box wide-modal">
              <div className="modal-header">
                <h3>Novo prazo</h3>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setModalPrazoAberto(false)}
                >
                  ×
                </button>
              </div>

              <form className="modal-form" onSubmit={salvarPrazo}>
                <label>
                  Descrição do prazo
                  <input
                    type="text"
                    value={formPrazo.descricao}
                    onChange={(e) =>
                      setFormPrazo((prev) => ({ ...prev, descricao: e.target.value }))
                    }
                    placeholder="Ex: Contestação"
                    required
                  />
                </label>

                <div className="form-two-columns">
                  <label>
                    Data inicial
                    <input
                      type="date"
                      value={formPrazo.data_inicio}
                      onChange={(e) =>
                        setFormPrazo((prev) => ({
                          ...prev,
                          data_inicio: e.target.value,
                        }))
                      }
                      required
                    />
                  </label>

                  <label>
                    Dias úteis
                    <input
                      type="number"
                      min="1"
                      value={formPrazo.dias_uteis}
                      onChange={(e) =>
                        setFormPrazo((prev) => ({
                          ...prev,
                          dias_uteis: e.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                </div>

                <label>
                  Prioridade
                  <select
                    value={formPrazo.prioridade}
                    onChange={(e) =>
                      setFormPrazo((prev) => ({
                        ...prev,
                        prioridade: e.target.value,
                      }))
                    }
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
      </div>
    </AppShell>
  );
}