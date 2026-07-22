from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from helpers.database import get_conn
from helpers.security import decodificar_token
import psycopg2

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_advogado_atual(token: str = Depends(oauth2_scheme)):
    payload = decodificar_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado.")

    advogado_id = payload.get("sub")
    conn = None
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT id, nome, email, oab FROM advogados WHERE id = %s", (advogado_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Advogado não encontrado.")
        return {"id": str(row[0]), "nome": row[1], "email": row[2], "oab": row[3]}
    except psycopg2.Error as e:
        print(e)
        raise HTTPException(status_code=500, detail="Erro interno.")
    finally:
        if conn:
            conn.close()