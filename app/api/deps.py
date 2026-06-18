from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.core.security import decodificar_token
from app.models.models import Advogado

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

async def get_advogado_atual(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Advogado:
    payload = decodificar_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado.")

    advogado_id = payload.get("sub")
    result = await db.execute(select(Advogado).where(Advogado.id == advogado_id))
    advogado = result.scalar_one_or_none()

    if not advogado:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Advogado não encontrado.")

    return advogado