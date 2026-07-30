class Prazo {
  constructor(id, processo_id, descricao, data_prazo, prioridade, status, lembrete_em, arquivo_url, criado_em) {
    this.id = id
    this.processo_id = processo_id
    this.descricao = descricao
    this.data_prazo = data_prazo
    this.prioridade = prioridade
    this.status = status
    this.lembrete_em = lembrete_em
    this.arquivo_url = arquivo_url
    this.criado_em = criado_em
  }
}

export default Prazo