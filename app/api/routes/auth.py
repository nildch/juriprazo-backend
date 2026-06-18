from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models.models import Advogado
from app.schemas.schemas import AdvogadoCreate, AdvogadoOut, LoginInput, TokenOut, RecuperarSenhaInput, RedefinirSenhaInput
from app.core.security import hash_senha, verificar_senha, criar_token
from datetime import datetime, timedelta
import uuid
 
router = APIRouter(prefix="/auth", tags=["Autenticação"])
 
@router.post("/cadastrar", response_model=AdvogadoOut, status_code=201)
async def cadastrar(dados: AdvogadoCreate, db: AsyncSession = Depends(get_db)):
    
    result = await db.execute(select(Advogado).where(Advogado.email == dados.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")
 
    advogado = Advogado(
        nome=dados.nome,
        email=dados.email,
        senha_hash=hash_senha(dados.senha),
        oab=dados.oab
    )
    db.add(advogado)
    await db.commit()
    await db.refresh(advogado)
    return advogado
 
@router.post("/login", response_model=TokenOut)
async def login(dados: LoginInput, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Advogado).where(Advogado.email == dados.email))
    advogado = result.scalar_one_or_none()
 
    if not advogado or not verificar_senha(dados.senha, advogado.senha_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas.")
 
    token = criar_token({"sub": str(advogado.id)})
    return {"access_token": token}
 
@router.post("/recuperar-senha")
async def recuperar_senha(dados: RecuperarSenhaInput, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Advogado).where(Advogado.email == dados.email))
    advogado = result.scalar_one_or_none()
 
    
    if advogado:
        token = str(uuid.uuid4())
        advogado.reset_token = token
        advogado.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
        await db.commit()
        
 
    return {"mensagem": "Se o e-mail existir, você receberá um link de recuperação."}
 
@router.post("/redefinir-senha")
async def redefinir_senha(dados: RedefinirSenhaInput, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Advogado).where(
            Advogado.reset_token == dados.token,
            Advogado.reset_token_expiry > datetime.utcnow()
        )
    )
    advogado = result.scalar_one_or_none()
    if not advogado:
        raise HTTPException(status_code=400, detail="Token inválido ou expirado.")
 
    advogado.senha_hash = hash_senha(dados.nova_senha)
    advogado.reset_token = None           
    advogado.reset_token_expiry = None
    await db.commit()
    return {"mensagem": "Senha redefinida com sucesso."}