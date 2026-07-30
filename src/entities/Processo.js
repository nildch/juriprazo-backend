class Processo {
  constructor(id, advogado_id, cliente_id, numero_cnj, vara, comarca, tribunal, status, criado_em) {
    this.id = id
    this.advogado_id = advogado_id
    this.cliente_id = cliente_id
    this.numero_cnj = numero_cnj
    this.vara = vara
    this.comarca = comarca
    this.tribunal = tribunal
    this.status = status
    this.criado_em = criado_em
  }
}

export default Processo