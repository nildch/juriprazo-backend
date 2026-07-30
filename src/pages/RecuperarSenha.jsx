import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setMensagem("");

    try {
      const response = await api.post("/auth/recuperar-senha", { email });
      setMensagem(response.data?.mensagem || "Solicitação enviada.");
    } catch {
      setErro("Não foi possível processar a solicitação.");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 420 }}>
        <h2>Recuperar senha</h2>
        <p>Informe seu e-mail cadastrado.</p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seuemail@exemplo.com"
          style={{ width: "100%", padding: 12, marginBottom: 12 }}
        />

        <button type="submit" style={{ width: "100%", padding: 12 }}>
          Enviar
        </button>

        {mensagem && <p>{mensagem}</p>}
        {erro && <p>{erro}</p>}

        <Link to="/login">Voltar ao login</Link>
      </form>
    </div>
  );
}