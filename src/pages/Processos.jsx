import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const CNJ_REGEX = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

export default function Processos() {
  const navigate = useNavigate();

  const [processos, setProcessos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [salvandoCliente, setSalvandoCliente] = useState(false);

  const [form, setForm] = useState({
    cliente_id: "",
    numero_cnj: "",
    vara: "",
    comarca: "",
    tribunal: "",
  });

  const [formCliente, setFormCliente] = useState({
    nome: "",
    email: "",
    telefone: "",
    cpf_cnpj: "",
  });

  async function carregarDados() {
    try {
      setErro("");
      const [resProcessos, resClientes] = await Promise.all([
        api.get("/processos"),
        api.get("/clientes"),
      ]);
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
      setErro("Não foi possível carregar os processos.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregarDados();
  }, []);

  const clientesMap = useMemo(() => {
    const map = new Map();
    clientes.forEach((cliente) => map.set(cliente.id, cliente));
    return map;
  }, [clientes]);

  const processosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    const base = [...processos].sort((a, b) => {
      const da = new Date(a.criado_em || 0).getTime();
      const db = new Date(b.criado_em || 0).getTime();
      return db - da;
    });

    if (!termo) return base;

    return base.filter((p) => {
      const cliente = clientesMap.get(p.cliente_id);
      return [
        p.numero_cnj,
        p.vara,
        p.comarca,
        p.tribunal,
        p.status,
        cliente?.nome,
        cliente?.email,
      ]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(termo));
    });
  }, [processos, busca, clientesMap]);

  function abrirNovo() {
    setEditandoId(null);
    setForm({
      cliente_id: clientes[0]?.id || "",
      numero_cnj: "",
      vara: "",
      comarca: "",
      tribunal: "",
    });
    setSucesso("");
    setErro("");
    if (clientes.length === 0) {
      setErro("Cadastre um cliente primeiro.");
      return;
    }
    setModalAberto(true);
  }

  function abrirEditar(processo) {
    setEditandoId(processo.id);
    setForm({
      cliente_id: processo.cliente_id || "",
      numero_cnj: processo.numero_cnj || "",
      vara: processo.vara || "",
      comarca: processo.comarca || "",
      tribunal: processo.tribunal || "",
    });
    setSucesso("");
    setErro("");
    setModalAberto(true);
  }

  function abrirModalCliente() {
    setFormCliente({
      nome: "",
      email: "",
      telefone: "",
      cpf_cnpj: "",
    });
    setErro("");
    setSucesso("");
    setModalClienteAberto(true);
  }

  async function salvarCliente(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");
    setSalvandoCliente(true);

    try {
      const response = await api.post("/clientes", {
        nome: formCliente.nome.trim(),
        email: formCliente.email.trim() || null,
        telefone: formCliente.telefone.trim() || null,
        cpf_cnpj: formCliente.cpf_cnpj.trim() || null,
      });

      const clienteCriado = response.data;
      await carregarDados();

      if (clienteCriado?.id) {
        setForm((prev) => ({ ...prev, cliente_id: clienteCriado.id }));
      }

      setModalClienteAberto(false);
      setSucesso("Cliente cadastrado com sucesso!");
    } catch (error) {
      const msg = error?.response?.data?.detail;
      setErro(msg || "Não foi possível cadastrar o cliente.");
    } finally {
      setSalvandoCliente(false);
    }
  }

  async function salvarProcesso(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    if (!form.cliente_id) {
      setErro("Selecione um cliente para vincular ao processo.");
      return;
    }

    if (!form.numero_cnj.trim()) {
      setErro("Número do processo é obrigatório.");
      return;
    }

    if (!CNJ_REGEX.test(form.numero_cnj.trim())) {
      setErro("O número do processo precisa seguir o padrão CNJ.");
      return;
    }

    try {
      const payload = {
        cliente_id: form.cliente_id,
        numero_cnj: form.numero_cnj.trim(),
        vara: form.vara.trim(),
        comarca: form.comarca.trim(),
        tribunal: form.tribunal.trim(),
      };

      if (editandoId) {
        await api.put(`/processos/${editandoId}`, payload);
        setSucesso("Processo atualizado com sucesso!");
      } else {
        await api.post("/processos", payload);
        setSucesso("Processo cadastrado com sucesso!");
      }

      setModalAberto(false);
      await carregarDados();
    } catch (error) {
      const msg = error?.response?.data?.detail;
      setErro(msg || "Não foi possível salvar o processo.");
    }
  }

  async function excluirProcesso(id) {
    const confirmar = window.confirm("Deseja excluir este processo?");
    if (!confirmar) return;

    try {
      await api.delete(`/processos/${id}`);
      await carregarDados();
    } catch (error) {
      const msg = error?.response?.data?.detail;
      setErro(msg || "Não foi possível excluir o processo.");
    }
  }

  function sair() {
    localStorage.removeItem("juriprazo_token");
    localStorage.removeItem("juriprazo_role");
    sessionStorage.removeItem("juriprazo_token");
    sessionStorage.removeItem("juriprazo_role");
    navigate("/login", { replace: true });
  }

  if (carregando) return <div className="crud-loading">Carregando processos...</div>;

  return (
    <AppShell
      title="Processos"
      subtitle="Cadastro e gestão dos processos jurídicos."
      actions={
        <>
          <button onClick={() => navigate("/dashboard")}>Voltar</button>
          <button onClick={abrirModalCliente}>Cadastrar cliente</button>
          <button onClick={abrirNovo} disabled={clientes.length === 0}>
            Adicione um novo Processo
          </button>
          <button className="logout-button" onClick={sair}>Sair</button>
        </>
      }
    >
      {clientes.length === 0 && (
        <div className="crud-alert error">Cadastre o cliente, para criar um processo.</div>
      )}

      {(erro || sucesso) && (
        <div className={erro ? "crud-alert error" : "crud-alert success"}>
          {erro || sucesso}
        </div>
      )}

      <section className="crud-toolbar">
        <input
          type="text"
          placeholder="Buscar por CNJ, cliente, vara, comarca ou tribunal..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <span>{processosFiltrados.length} processo(s)</span>
      </section>

      {processosFiltrados.length === 0 ? (
        <div className="empty-box">Nenhum processo encontrado.</div>
      ) : (
        <div className="list-grid">
          {processosFiltrados.map((processo) => {
            const cliente = clientesMap.get(processo.cliente_id);
            return (
              <article className="list-card" key={processo.id}>
                <div className="list-card-main">
                  <div className="list-card-title">
                    <strong>{processo.numero_cnj || "Sem CNJ"}</strong>
                    <span className="status-pill">{String(processo.status || "ativo")}</span>
                  </div>

                  <p><b>Cliente:</b> {cliente?.nome || "Cliente não encontrado"}</p>
                  <p><b>Tribunal:</b> {processo.tribunal || "-"}</p>
                  <p><b>Vara/Comarca:</b> {processo.vara || "-"} / {processo.comarca || "-"}</p>
                  <p><b>Criado em:</b> {processo.criado_em ? new Date(processo.criado_em).toLocaleString("pt-BR") : "-"}</p>
                </div>

                <div className="list-card-actions">
                  <button onClick={() => navigate(`/processos/${processo.id}`)}>Detalhes</button>
                  <button onClick={() => abrirEditar(processo)}>Editar</button>
                  <button onClick={() => excluirProcesso(processo.id)}>Excluir</button>
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
              <h3>{editandoId ? "Editar processo" : "Novo processo"}</h3>
              <button type="button" className="modal-close" onClick={() => setModalAberto(false)}>×</button>
            </div>

            <form className="modal-form" onSubmit={salvarProcesso}>
              <label>
                Cliente
                <select
                  value={form.cliente_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, cliente_id: e.target.value }))}
                  required
                  disabled={clientes.length === 0}
                >
                  <option value="">{clientes.length === 0 ? "Nenhum cliente cadastrado" : "Selecione"}</option>
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
                  value={form.numero_cnj}
                  onChange={(e) => setForm((prev) => ({ ...prev, numero_cnj: formatCnj(e.target.value) }))}
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
                    value={form.tribunal}
                    onChange={(e) => setForm((prev) => ({ ...prev, tribunal: e.target.value }))}
                    placeholder="TJPB, TST, TRF1..."
                  />
                </label>

                <label>
                  Vara
                  <input
                    type="text"
                    value={form.vara}
                    onChange={(e) => setForm((prev) => ({ ...prev, vara: e.target.value }))}
                    placeholder="Ex: 1ª Vara Civil"
                  />
                </label>
              </div>

              <label>
                Comarca
                <input
                  type="text"
                  value={form.comarca}
                  onChange={(e) => setForm((prev) => ({ ...prev, comarca: e.target.value }))}
                  placeholder="Ex: João Pessoa"
                />
              </label>

              <button type="submit" className="login-button">
                {editandoId ? "Salvar alterações" : "Salvar processo"}
              </button>
            </form>
          </div>
        </div>
      )}

      {modalClienteAberto && (
        <div className="modal-overlay">
          <div className="modal-box wide-modal">
            <div className="modal-header">
              <h3>Cadastrar cliente</h3>
              <button type="button" className="modal-close" onClick={() => setModalClienteAberto(false)}>×</button>
            </div>

            <form className="modal-form" onSubmit={salvarCliente}>
              <label>
                Nome
                <input
                  type="text"
                  value={formCliente.nome}
                  onChange={(e) => setFormCliente((prev) => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome do cliente"
                  required
                />
              </label>

              <label>
                E-mail
                <input
                  type="email"
                  value={formCliente.email}
                  onChange={(e) => setFormCliente((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="cliente@email.com"
                />
              </label>

              <div className="form-two-columns">
                <label>
                  Telefone
                  <input
                    type="text"
                    value={formCliente.telefone}
                    onChange={(e) => setFormCliente((prev) => ({ ...prev, telefone: e.target.value }))}
                    placeholder="(83) 99999-9999"
                  />
                </label>

                <label>
                  CPF/CNPJ
                  <input
                    type="text"
                    value={formCliente.cpf_cnpj}
                    onChange={(e) => setFormCliente((prev) => ({ ...prev, cpf_cnpj: e.target.value }))}
                    placeholder="CPF ou CNPJ"
                  />
                </label>
              </div>

              <button type="submit" className="login-button" disabled={salvandoCliente}>
                {salvandoCliente ? "Salvando..." : "Salvar cliente"}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
