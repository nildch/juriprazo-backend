class Advogado:
    def __init__(self, id, nome, email, oab, criado_em):
        self.id = id
        self.nome = nome
        self.email = email
        self.oab = oab
        self.criado_em = criado_em

    def toDict(self):
        return {
            "id": str(self.id),
            "nome": self.nome,
            "email": self.email,
            "oab": self.oab,
            "criado_em": str(self.criado_em)
        }