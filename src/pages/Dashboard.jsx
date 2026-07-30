import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import AppShell from "../components/AppShell";

function parseDateOnly(value) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`);
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isWithinNextDays(date, days) {
  if (!date) return false;
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.floor((date - base) / 86400000);
  return diff >= 0 && diff <= days;
}

function formatDateBR(value) {
  if (!value) return "-";
  const date = parseDateOnly(value);
  return date.toLocaleDateString("pt-BR");
}

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const startWeekDay = firstDay.getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekDay; i++) cells.push(null);
  for (let day = 1; day <= lastDay; day++) {
    cells.push(new Date(year, month, day));
  }
  return cells;
}

function normalizarStatusProcesso(status) {
  const valor = String(status ?? "").trim().toLowerCase();
  if (!valor) return "ativo";
  return valor;
}

const STORAGE_KEY = "juriprazo_dashboard_alertas_lidos";

function carregarAlertasLidos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [prazos, setPrazos] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [alertasLidos, setAlertasLidos] = useState(carregarAlertasLidos);

  const hoje = useMemo(() => new Date(), []);
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alertasLidos));
    } catch {
      // 
    }
  }, [alertasLidos]);

  useEffect(() => {
    async function carregarDados() {
      try {
        setErro("");
        setPrazos([]);
        setProcessos([]);
        const [resPrazos, resProcessos] = await Promise.all([
          api.get("/prazos"),
          api.get("/processos"),
        ]);

        setPrazos(Array.isArray(resPrazos.data) ? resPrazos.data : []);
        setProcessos(Array.isArray(resProcessos.data) ? resProcessos.data : []);
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

        setErro("Não foi possível carregar a dashboard.");
      } finally {
        setCarregando(false);
      }
    }

    carregarDados();

    return () => {
      api.patch("/notificacoes/marcar-todas-lidas").catch(() => {});
    };
  }, [navigate]);

  const resumo = useMemo(() => {
    const hojeRef = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate()
    );

    const prazosConvertidos = prazos
      .map((p) => ({ ...p, dataObj: parseDateOnly(p.data_prazo) }))
      .filter((p) => p.dataObj);

    const hojeCount = prazosConvertidos.filter((p) =>
      isSameDay(p.dataObj, hojeRef)
    ).length;

    const semanaCount = prazosConvertidos.filter((p) =>
      isWithinNextDays(p.dataObj, 7)
    ).length;

    const processosAtivos = processos.filter((p) => {
      const status = normalizarStatusProcesso(p.status);
      return status === "ativo";
    }).length;

    return { hojeCount, semanaCount, processosAtivos };
  }, [prazos, processos, hoje]);

  const alertas = useMemo(() => {
    const hojeRef = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const lidos = new Set(alertasLidos);

    return [...prazos]
      .map((p) => ({ ...p, dataObj: parseDateOnly(p.data_prazo) }))
      .filter((p) => p.dataObj)
      .sort((a, b) => a.dataObj - b.dataObj)
      .slice(0, 5)
      .map((p) => {
        const diff = Math.floor((p.dataObj - hojeRef) / 86400000);
        return {
          ...p,
          diff,
          rotulo:
            diff < 0 ? "Vencido" : diff === 0 ? "Vence hoje" : `Em ${diff} dia(s)`,
        };
      })
      .filter((p) => !lidos.has(p.id));
  }, [prazos, hoje, alertasLidos]);

  const diasComPrazo = useMemo(() => {
    const mapa = new Map();

    prazos.forEach((p) => {
      const data = p.data_prazo;
      if (!data) return;
      mapa.set(data, (mapa.get(data) || 0) + 1);
    });

    return mapa;
  }, [prazos]);

  const gridCalendario = useMemo(() => getMonthGrid(ano, mes), [ano, mes]);

  function abrirDetalhePrazo(prazo) {
    if (prazo?.processo_id) {
      navigate(`/processos/${prazo.processo_id}`);
      return;
    }
    navigate("/prazos");
  }

  function marcarAlertaComoLido(id) {
    setAlertasLidos((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  }

  function sair() {
    localStorage.removeItem("juriprazo_token");
    localStorage.removeItem("juriprazo_role");
    sessionStorage.removeItem("juriprazo_token");
    sessionStorage.removeItem("juriprazo_role");
    navigate("/login", { replace: true });
  }

  if (carregando) {
    return <div className="dashboard-loading">Carregando dashboard...</div>;
  }

  return (
    <AppShell
      title="Painel de Controle"
      subtitle="Visão geral dos prazos, processos e prioridades do dia."
      actions={
        <>
          <button onClick={() => navigate("/processos")}>Processos</button>
          <button onClick={() => navigate("/prazos")}>Prazos</button>
          <button className="logout-button" onClick={sair}>
            Sair
          </button>
        </>
      }
    >
      {erro && <div className="dashboard-error">{erro}</div>}

      <section className="dashboard-cards">
        <article className="summary-card">
          <span>Prazos para hoje</span>
          <strong>{resumo.hojeCount}</strong>
        </article>

        <article className="summary-card">
          <span>Prazos da semana</span>
          <strong>{resumo.semanaCount}</strong>
        </article>

        <article className="summary-card">
          <span>Processos ativos</span>
          <strong>{resumo.processosAtivos}</strong>
        </article>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-panel dashboard-alerts">
          <div className="panel-header">
            <h2>Alertas urgentes</h2>
            <span>{alertas.length} prazos</span>
          </div>

          <div className="alert-list">
            {alertas.length === 0 ? (
              <p className="empty-state">Nenhum prazo próximo do vencimento.</p>
            ) : (
              alertas.map((prazo) => (
                <article
                  key={prazo.id}
                  className={`alert-item ${prazo.diff <= 0 ? "critical" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => abrirDetalhePrazo(prazo)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      abrirDetalhePrazo(prazo);
                    }
                  }}
                >
                  <div className="alert-main">
                    <strong>{prazo.descricao}</strong>
                    <span>Data: {formatDateBR(prazo.data_prazo)}</span>
                  </div>

                  <div className="alert-meta">
                    <span className="alert-badge">{prazo.rotulo}</span>
                    <small>{String(prazo.prioridade || "media").toUpperCase()}</small>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        marcarAlertaComoLido(prazo.id);
                      }}
                      style={{
                        marginTop: "8px",
                        border: "none",
                        borderRadius: "999px",
                        padding: "8px 12px",
                        background: "#4e77b9",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Marcar como lido
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="dashboard-panel dashboard-calendar">
          <div className="panel-header">
            <h2>Mini calendário</h2>
            <span>
              {hoje.toLocaleString("pt-BR", { month: "long" })} / {ano}
            </span>
          </div>

          <div className="calendar-weekdays">
            <span>Dom</span>
            <span>Seg</span>
            <span>Ter</span>
            <span>Qua</span>
            <span>Qui</span>
            <span>Sex</span>
            <span>Sáb</span>
          </div>

          <div className="calendar-grid">
            {gridCalendario.map((dia, index) => {
              const key = dia ? dia.toISOString().split("T")[0] : `empty-${index}`;
              const dataStr = dia ? dia.toISOString().split("T")[0] : null;
              const qtde = dataStr ? diasComPrazo.get(dataStr) || 0 : 0;
              const isToday = dia ? isSameDay(dia, hoje) : false;

              return (
                <div
                  key={key}
                  className={`calendar-cell ${!dia ? "blank" : ""} ${isToday ? "today" : ""}`}
                >
                  {dia && (
                    <>
                      <span>{dia.getDate()}</span>
                      {qtde > 0 && <small>{qtde}</small>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </AppShell>
  );
}