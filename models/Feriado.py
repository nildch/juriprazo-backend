class Feriado:
    def __init__(self, id, data, descricao, tipo, uf, criado_em):
        self.id = id
        self.data = data
        self.descricao = descricao
        self.tipo = tipo
        self.uf = uf
        self.criado_em = criado_em

    def toDict(self):
        return {
            "id": str(self.id),
            "data": str(self.data),
            "descricao": self.descricao,
            "tipo": self.tipo,
            "uf": self.uf,
            "criado_em": str(self.criado_em)
        }