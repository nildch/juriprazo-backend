class Cliente {
  constructor(id, advogado_id, nome, email, telefone, cpf_cnpj, criado_em) {
    this.id = id
    this.advogado_id = advogado_id
    this.nome = nome
    this.email = email
    this.telefone = telefone
    this.cpf_cnpj = cpf_cnpj
    this.criado_em = criado_em
  }
}

export default Cliente