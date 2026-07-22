import psycopg2
import uuid
from datetime import date, datetime, timedelta
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from helpers.application import app
from helpers.database import get_conn
from helpers.security import hash_senha, verificar_senha, criar_token
from helpers.auth import get_advogado_atual

from models.Advogado import Advogado
from models.Cliente import Cliente
from models.Processo import Processo
from models.Prazo import Prazo
from models.Notificacao import Notificacao
from models.Feriado import Feriado
from models.Movimentacao import Movimentacao


class AdvogadoInput(BaseModel):
    nome: str
    email: str
    senha: str
    oab: str

class LoginInput(BaseModel):
    email: str
    senha: str

class RecuperarSenhaInput(BaseModel):
    email: str

class RedefinirSenhaInput(BaseModel):
    token: str
    nova_senha: str

class ClienteInput(BaseModel):
    nome: str
    email: Optional[str] = None
    telefone: Optional[str] = None
    cpf_cnpj: Optional[str] = None

class ProcessoInput(BaseModel):
    cliente_id: str
    numero_cnj: Optional[str] = None
    vara: Optional[str] = None
    comarca: Optional[str] = None
    tribunal: Optional[str] = None

class PrazoInput(BaseModel):
    processo_id: str
    descricao: str
    data_inicio: date
    dias_uteis: int
    prioridade: Optional[str] = "media"

class PrazoStatusInput(BaseModel):
    status: str

class FeriadoInput(BaseModel):
    data: date
    descricao: str
    tipo: str
    uf: Optional[str] = None

class MovimentacaoInput(BaseModel):
    descricao: str


def calcular_data_prazo(data_inicio: date, dias_uteis: int) -> date:
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT data FROM feriados WHERE uf IS NULL")
        rows = cursor.fetchall()
        datas_feriado = {row[0] for row in rows}
    except psycopg2.Error as e:
        print(e)
        datas_feriado = set()
    finally:
        if conn:
            conn.close()

    data_atual = data_inicio
    dias_contados = 0
    while dias_contados < dias_uteis:
        data_atual += timedelta(days=1)
        if data_atual.weekday() >= 5:       # sábado ou domingo
            continue
        if data_atual in datas_feriado:     # feriado nacional
            continue
        dias_contados += 1
    return data_atual


@app.get("/")
def index():
    return {"versao": "1.0.0", "status": "API rodando ✓"}

@app.get("/health")
def healthCheck():
    return {"online": True}


@app.post("/auth/cadastrar", status_code=201)
def cadastrarAdvogado(dados: AdvogadoInput):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM advogados WHERE email = %s", (dados.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="E-mail já cadastrado.")

        senha_hash = hash_senha(dados.senha)
        cursor.execute(
            "INSERT INTO advogados (nome, email, senha_hash, oab) VALUES (%s, %s, %s, %s) RETURNING id, nome, email, oab, criado_em",
            (dados.nome, dados.email, senha_hash, dados.oab)
        )
        row = cursor.fetchone()
        conn.commit()
        advogado = Advogado(row[0], row[1], row[2], row[3], row[4])
        return advogado.toDict()

    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao cadastrar.")
    finally:
        if conn:
            conn.close()

@app.post("/auth/login")
def loginAdvogado(dados: LoginInput):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT id, senha_hash FROM advogados WHERE email = %s", (dados.email,))
        row = cursor.fetchone()

        if not row or not verificar_senha(dados.senha, row[1]):
            raise HTTPException(status_code=401, detail="Credenciais inválidas.")

        token = criar_token(str(row[0]))
        return {"access_token": token, "token_type": "bearer"}

    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro no login.")
    finally:
        if conn:
            conn.close()

@app.post("/auth/recuperar-senha")
def recuperarSenha(dados: RecuperarSenhaInput):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM advogados WHERE email = %s", (dados.email,))
        row = cursor.fetchone()

        if row:
            token = str(uuid.uuid4())
            expiry = datetime.utcnow() + timedelta(hours=1)
            cursor.execute(
                "UPDATE advogados SET reset_token = %s, reset_token_expiry = %s WHERE id = %s",
                (token, expiry, row[0])
            )
            conn.commit()
            

        return {"mensagem": "Se o e-mail existir, você receberá as instruções de recuperação."}

    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao recuperar senha.")
    finally:
        if conn:
            conn.close()

@app.post("/auth/redefinir-senha")
def redefinirSenha(dados: RedefinirSenhaInput):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM advogados WHERE reset_token = %s AND reset_token_expiry > NOW()",
            (dados.token,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=400, detail="Token inválido ou expirado.")

        cursor.execute(
            "UPDATE advogados SET senha_hash = %s, reset_token = NULL, reset_token_expiry = NULL WHERE id = %s",
            (hash_senha(dados.nova_senha), row[0])
        )
        conn.commit()
        return {"mensagem": "Senha redefinida com sucesso."}

    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao redefinir senha.")
    finally:
        if conn:
            conn.close()


@app.get("/clientes")
def getClientes(advogado=Depends(get_advogado_atual)):
    clientes = []
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, advogado_id, nome, email, telefone, cpf_cnpj, criado_em FROM clientes WHERE advogado_id = %s ORDER BY nome",
            (advogado["id"],)
        )
        rows = cursor.fetchall()
        for row in rows:
            clientes.append(Cliente(row[0], row[1], row[2], row[3], row[4], row[5], row[6]).toDict())
    except psycopg2.Error as e:
        print(e)
    finally:
        if conn:
            conn.close()
    return clientes

@app.get("/clientes/{cliente_id}")
def getCliente(cliente_id: str, advogado=Depends(get_advogado_atual)):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, advogado_id, nome, email, telefone, cpf_cnpj, criado_em FROM clientes WHERE id = %s AND advogado_id = %s",
            (cliente_id, advogado["id"])
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")
        return Cliente(row[0], row[1], row[2], row[3], row[4], row[5], row[6]).toDict()
    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao buscar cliente.")
    finally:
        if conn:
            conn.close()

@app.post("/clientes", status_code=201)
def postCliente(dados: ClienteInput, advogado=Depends(get_advogado_atual)):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO clientes (advogado_id, nome, email, telefone, cpf_cnpj) VALUES (%s, %s, %s, %s, %s) RETURNING id, advogado_id, nome, email, telefone, cpf_cnpj, criado_em",
            (advogado["id"], dados.nome, dados.email, dados.telefone, dados.cpf_cnpj)
        )
        row = cursor.fetchone()
        conn.commit()
        return Cliente(row[0], row[1], row[2], row[3], row[4], row[5], row[6]).toDict()
    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao cadastrar cliente.")
    finally:
        if conn:
            conn.close()

@app.put("/clientes/{cliente_id}")
def putCliente(cliente_id: str, dados: ClienteInput, advogado=Depends(get_advogado_atual)):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE clientes SET nome=%s, email=%s, telefone=%s, cpf_cnpj=%s WHERE id=%s AND advogado_id=%s RETURNING id, advogado_id, nome, email, telefone, cpf_cnpj, criado_em",
            (dados.nome, dados.email, dados.telefone, dados.cpf_cnpj, cliente_id, advogado["id"])
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")
        conn.commit()
        return Cliente(row[0], row[1], row[2], row[3], row[4], row[5], row[6]).toDict()
    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao atualizar cliente.")
    finally:
        if conn:
            conn.close()

@app.delete("/clientes/{cliente_id}", status_code=204)
def deleteCliente(cliente_id: str, advogado=Depends(get_advogado_atual)):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM clientes WHERE id = %s AND advogado_id = %s", (cliente_id, advogado["id"]))
        conn.commit()
    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao excluir cliente.")
    finally:
        if conn:
            conn.close()


@app.get("/processos")
def getProcessos(tribunal: Optional[str] = None, advogado=Depends(get_advogado_atual)):
    processos = []
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        query = "SELECT id, advogado_id, cliente_id, numero_cnj, vara, comarca, tribunal, status, criado_em FROM processos WHERE advogado_id = %s"
        params = [advogado["id"]]
        if tribunal:
            query += " AND tribunal = %s"
            params.append(tribunal)
        query += " ORDER BY criado_em DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        for row in rows:
            processos.append(Processo(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]).toDict())
    except psycopg2.Error as e:
        print(e)
    finally:
        if conn:
            conn.close()
    return processos

@app.get("/processos/{processo_id}")
def getProcesso(processo_id: str, advogado=Depends(get_advogado_atual)):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, advogado_id, cliente_id, numero_cnj, vara, comarca, tribunal, " 
            "status, criado_em FROM processos WHERE id = %s AND advogado_id = %s",
            (processo_id, advogado["id"])
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Processo não encontrado.")
        return Processo(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]).toDict()
    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao buscar processo.")
    finally:
        if conn:
            conn.close()

@app.post("/processos", status_code=201)
def postProcesso(dados: ProcessoInput, advogado=Depends(get_advogado_atual)):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO processos (advogado_id, cliente_id, numero_cnj, vara, comarca, tribunal) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id, advogado_id, cliente_id, numero_cnj, vara, comarca, tribunal, status, criado_em",
            (advogado["id"], dados.cliente_id, dados.numero_cnj, dados.vara, dados.comarca, dados.tribunal)
        )
        row = cursor.fetchone()
        conn.commit()
        return Processo(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]).toDict()
    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao cadastrar processo.")
    finally:
        if conn:
            conn.close()

@app.put("/processos/{processo_id}")
def putProcesso(processo_id: str, dados: ProcessoInput, advogado=Depends(get_advogado_atual)):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE processos SET cliente_id=%s, numero_cnj=%s, vara=%s, comarca=%s, tribunal=%s WHERE id=%s AND advogado_id=%s RETURNING id, advogado_id, cliente_id, numero_cnj, vara, comarca, tribunal, status, criado_em",
            (dados.cliente_id, dados.numero_cnj, dados.vara, dados.comarca, dados.tribunal, processo_id, advogado["id"])
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Processo não encontrado.")
        conn.commit()
        return Processo(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]).toDict()
    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao atualizar processo.")
    finally:
        if conn:
            conn.close()

@app.delete("/processos/{processo_id}", status_code=204)
def deleteProcesso(processo_id: str, advogado=Depends(get_advogado_atual)):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT id FROM prazos WHERE processo_id = %s AND status = 'pendente'",
            (processo_id,)
        )
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="Não é possível excluir um processo com prazos pendentes.")
        cursor.execute("DELETE FROM processos WHERE id = %s AND advogado_id = %s", (processo_id, advogado["id"]))
        conn.commit()
    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao excluir processo.")
    finally:
        if conn:
            conn.close()


@app.get("/prazos")
def getPrazos(tribunal: Optional[str] = None, advogado=Depends(get_advogado_atual)):
    prazos = []
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        query = """
            SELECT p.id, p.processo_id, p.descricao, p.data_prazo, p.prioridade, p.status, p.lembrete_em, p.arquivo_url, p.criado_em
            FROM prazos p
            JOIN processos pr ON pr.id = p.processo_id
            WHERE pr.advogado_id = %s
        """
        params = [advogado["id"]]
        if tribunal:
            query += " AND pr.tribunal = %s"
            params.append(tribunal)
        query += " ORDER BY p.data_prazo ASC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        for row in rows:
            prazos.append(Prazo(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]).toDict())
    except psycopg2.Error as e:
        print(e)
    finally:
        if conn:
            conn.close()
    return prazos

@app.get("/prazos/dashboard")
def getDashboard(advogado=Depends(get_advogado_atual)):
    
    resultado = []
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.id, p.processo_id, p.descricao, p.data_prazo, p.prioridade, p.status, p.lembrete_em, p.arquivo_url, p.criado_em
            FROM prazos p
            JOIN processos pr ON pr.id = p.processo_id
            WHERE pr.advogado_id = %s
              AND p.status = 'pendente'
              AND p.data_prazo <= CURRENT_DATE + INTERVAL '7 days'
            ORDER BY p.data_prazo ASC
        """, (advogado["id"],))
        rows = cursor.fetchall()
        hoje = date.today()
        for row in rows:
            prazo = Prazo(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]).toDict()
            prazo["urgente"] = (row[3] - hoje).days <= 1   # RF 2.7 — vermelho
            prazo["janela"] = "hoje" if row[3] == hoje else "semana"
            resultado.append(prazo)
    except psycopg2.Error as e:
        print(e)
    finally:
        if conn:
            conn.close()
    return resultado

@app.post("/prazos", status_code=201)
def postPrazo(dados: PrazoInput, advogado=Depends(get_advogado_atual)):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()

        
        cursor.execute("SELECT id FROM processos WHERE id = %s AND advogado_id = %s", (dados.processo_id, advogado["id"]))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Processo não encontrado ou sem permissão.")

        
        data_prazo = calcular_data_prazo(dados.data_inicio, dados.dias_uteis)
        lembrete_em = datetime.combine(data_prazo, datetime.min.time()) - timedelta(days=1)

        cursor.execute(
            "INSERT INTO prazos (processo_id, descricao, data_prazo, prioridade, lembrete_em) VALUES (%s, %s, %s, %s, %s) RETURNING id, processo_id, descricao, data_prazo, prioridade, status, lembrete_em, arquivo_url, criado_em",
            (dados.processo_id, dados.descricao, data_prazo, dados.prioridade, lembrete_em)
        )
        row = cursor.fetchone()
        conn.commit()
        return Prazo(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]).toDict()
    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao cadastrar prazo.")
    finally:
        if conn:
            conn.close()

@app.patch("/prazos/{prazo_id}/status")
def patchPrazoStatus(prazo_id: str, dados: PrazoStatusInput, advogado=Depends(get_advogado_atual)):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE prazos SET status = %s FROM processos WHERE prazos.processo_id = processos.id AND prazos.id = %s AND processos.advogado_id = %s RETURNING prazos.id, prazos.processo_id, prazos.descricao, prazos.data_prazo, prazos.prioridade, prazos.status, prazos.lembrete_em, prazos.arquivo_url, prazos.criado_em",
            (dados.status, prazo_id, advogado["id"])
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Prazo não encontrado.")
        conn.commit()
        return Prazo(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]).toDict()
    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao atualizar status.")
    finally:
        if conn:
            conn.close()

@app.delete("/prazos/{prazo_id}", status_code=204)
def deletePrazo(prazo_id: str, advogado=Depends(get_advogado_atual)):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM prazos USING processos WHERE prazos.processo_id = processos.id AND prazos.id = %s AND processos.advogado_id = %s",
            (prazo_id, advogado["id"])
        )
        conn.commit()
    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao excluir prazo.")
    finally:
        if conn:
            conn.close()


@app.get("/feriados")
def getFeriados():
    feriados = []
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT id, data, descricao, tipo, uf, criado_em FROM feriados ORDER BY data")
        rows = cursor.fetchall()
        for row in rows:
            feriados.append(Feriado(row[0], row[1], row[2], row[3], row[4], row[5]).toDict())
    except psycopg2.Error as e:
        print(e)
    finally:
        if conn:
            conn.close()
    return feriados

@app.post("/feriados", status_code=201)
def postFeriado(dados: FeriadoInput, advogado=Depends(get_advogado_atual)):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO feriados (data, descricao, tipo, uf) VALUES (%s, %s, %s, %s) RETURNING id, data, descricao, tipo, uf, criado_em",
            (dados.data, dados.descricao, dados.tipo, dados.uf)
        )
        row = cursor.fetchone()
        conn.commit()
        return Feriado(row[0], row[1], row[2], row[3], row[4], row[5]).toDict()
    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao cadastrar feriado.")
    finally:
        if conn:
            conn.close()

@app.delete("/feriados/{feriado_id}", status_code=204)
def deleteFeriado(feriado_id: str, advogado=Depends(get_advogado_atual)):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM feriados WHERE id = %s", (feriado_id,))
        conn.commit()
    except psycopg2.Error as e:
        print(e)
    finally:
        if conn:
            conn.close()

@app.get("/notificacoes")
def getNotificacoes(apenas_nao_lidas: bool = False, advogado=Depends(get_advogado_atual)):
    notificacoes = []
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        query = "SELECT id, advogado_id, prazo_id, mensagem, lida, enviada_em FROM notificacoes WHERE advogado_id = %s"
        params = [advogado["id"]]
        if apenas_nao_lidas:
            query += " AND lida = FALSE"
        query += " ORDER BY enviada_em DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        for row in rows:
            notificacoes.append(Notificacao(row[0], row[1], row[2], row[3], row[4], row[5]).toDict())
    except psycopg2.Error as e:
        print(e)
    finally:
        if conn:
            conn.close()
    return notificacoes

@app.patch("/notificacoes/{notificacao_id}/lida")
def marcarComoLida(notificacao_id: str, advogado=Depends(get_advogado_atual)):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE notificacoes SET lida = TRUE WHERE id = %s AND advogado_id = %s RETURNING id, advogado_id, prazo_id, mensagem, lida, enviada_em",
            (notificacao_id, advogado["id"])
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Notificação não encontrada.")
        conn.commit()
        return Notificacao(row[0], row[1], row[2], row[3], row[4], row[5]).toDict()
    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao marcar notificação.")
    finally:
        if conn:
            conn.close()

@app.patch("/notificacoes/marcar-todas-lidas")
def marcarTodasLidas(advogado=Depends(get_advogado_atual)):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE notificacoes SET lida = TRUE WHERE advogado_id = %s AND lida = FALSE",
            (advogado["id"],)
        )
        count = cursor.rowcount
        conn.commit()
        return {"mensagem": f"{count} notificação(ões) marcada(s) como lida(s)."}
    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao marcar notificações.")
    finally:
        if conn:
            conn.close()

@app.get("/prazos/{prazo_id}/movimentacoes")
def getMovimentacoes(prazo_id: str, advogado=Depends(get_advogado_atual)):
    movimentacoes = []
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT m.id, m.prazo_id, m.advogado_id, m.descricao, m.criado_em
               FROM movimentacoes m
               JOIN prazos p ON p.id = m.prazo_id
               JOIN processos pr ON pr.id = p.processo_id
               WHERE m.prazo_id = %s AND pr.advogado_id = %s
               ORDER BY m.criado_em DESC""",
            (prazo_id, advogado["id"])
        )
        rows = cursor.fetchall()
        for row in rows:
            movimentacoes.append(Movimentacao(row[0], row[1], row[2], row[3], row[4]).toDict())
    except psycopg2.Error as e:
        print(e)
    finally:
        if conn:
            conn.close()
    return movimentacoes

@app.post("/prazos/{prazo_id}/movimentacoes", status_code=201)
def postMovimentacao(prazo_id: str, dados: MovimentacaoInput, advogado=Depends(get_advogado_atual)):
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO movimentacoes (prazo_id, advogado_id, descricao) VALUES (%s, %s, %s) RETURNING id, prazo_id, advogado_id, descricao, criado_em",
            (prazo_id, advogado["id"], dados.descricao)
        )
        row = cursor.fetchone()
        conn.commit()
        return Movimentacao(row[0], row[1], row[2], row[3], row[4]).toDict()
    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro ao registrar movimentação.")
    finally:
        if conn:
            conn.close()