class Notificacao:
    def __init__(self, id, advogado_id, prazo_id, mensagem, lida, enviada_em):
        self.id = id
        self.advogado_id = advogado_id
        self.prazo_id = prazo_id
        self.mensagem = mensagem
        self.lida = lida
        self.enviada_em = enviada_em

    def toDict(self):
        return {
            "id": str(self.id),
            "advogado_id": str(self.advogado_id),
            "prazo_id": str(self.prazo_id),
            "mensagem": self.mensagem,
            "lida": self.lida,
            "enviada_em": str(self.enviada_em)
        }