class Prazo:
    def __init__(self, id, processo_id, descricao, data_prazo, prioridade, status, lembrete_em, arquivo_url, criado_em):
        self.id = id
        self.processo_id = processo_id
        self.descricao = descricao
        self.data_prazo = data_prazo
        self.prioridade = prioridade
        self.status = status
        self.lembrete_em = lembrete_em
        self.arquivo_url = arquivo_url
        self.criado_em = criado_em

    def toDict(self):
        return {
            "id": str(self.id),
            "processo_id": str(self.processo_id),
            "descricao": self.descricao,
            "data_prazo": str(self.data_prazo),
            "prioridade": self.prioridade,
            "status": self.status,
            "lembrete_em": str(self.lembrete_em) if self.lembrete_em else None,
            "arquivo_url": self.arquivo_url,
            "criado_em": str(self.criado_em)
        }