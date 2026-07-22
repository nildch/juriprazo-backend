class Processo:
    def __init__(self, id, advogado_id, cliente_id, numero_cnj, vara, comarca, tribunal, status, criado_em):
        self.id = id
        self.advogado_id = advogado_id
        self.cliente_id = cliente_id
        self.numero_cnj = numero_cnj
        self.vara = vara
        self.comarca = comarca
        self.tribunal = tribunal
        self.status = status
        self.criado_em = criado_em

    def toDict(self):
        return {
            "id": str(self.id),
            "advogado_id": str(self.advogado_id),
            "cliente_id": str(self.cliente_id),
            "numero_cnj": self.numero_cnj,
            "vara": self.vara,
            "comarca": self.comarca,
            "tribunal": self.tribunal,
            "status": self.status,
            "criado_em": str(self.criado_em)
        }