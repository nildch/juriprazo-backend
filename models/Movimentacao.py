class Movimentacao:
    def __init__(self, id, prazo_id, advogado_id, descricao, criado_em):
        self.id = id
        self.prazo_id = prazo_id
        self.advogado_id = advogado_id
        self.descricao = descricao
        self.criado_em = criado_em

    def toDict(self):
        return {
            "id": str(self.id),
            "prazo_id": str(self.prazo_id),
            "advogado_id": str(self.advogado_id),
            "descricao": self.descricao,
            "criado_em": str(self.criado_em)
        }