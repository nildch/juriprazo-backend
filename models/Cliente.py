class Cliente:
    def __init__(self, id, advogado_id, nome, email, telefone, cpf_cnpj, criado_em):
        self.id = id
        self.advogado_id = advogado_id
        self.nome = nome
        self.email = email
        self.telefone = telefone
        self.cpf_cnpj = cpf_cnpj
        self.criado_em = criado_em

    def toDict(self):
        return {
            "id": str(self.id),
            "advogado_id": str(self.advogado_id),
            "nome": self.nome,
            "email": self.email,
            "telefone": self.telefone,
            "cpf_cnpj": self.cpf_cnpj,
            "criado_em": str(self.criado_em)
        }