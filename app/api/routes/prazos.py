from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models.models import Prazo, Processo, Advogado
from app.schemas.schemas import PrazoCreate, PrazoOut, PrazoStatusUpdate
from app.api.deps import get_advogado_atual
from app.services.prazo_service import calcular_data_prazo
from datetime import datetime, timedelta

router = APIRouter(prefix="/prazos", tags=["Prazos"])

@router.post("/", response_model=PrazoOut, status_code=201)
async def criar_prazo(
    dados: PrazoCreate,
    db: AsyncSession = Depends(get_db),
    advogado: Advogado = Depends(get_advogado_atual)
):
    
    result = await db.execute(
        select(Processo).where(Processo.id == dados.processo_id, Processo.advogado_id == advogado.id)
    )
    processo = result.scalar_one_or_none()
    if not processo:
        raise HTTPException(status_code=403, detail="Processo não encontrado ou sem permissão.")

    
    data_prazo = await calcular_data_prazo(dados.data_inicio, dados.dias_uteis, db)

    prazo = Prazo(
        processo_id=dados.processo_id,
        descricao=dados.descricao,
        data_prazo=data_prazo,
        prioridade=dados.prioridade,
        lembrete_em=datetime.combine(data_prazo, datetime.min.time()) - timedelta(days=1)
    )
    db.add(prazo)
    await db.commit()
    await db.refresh(prazo)
    return prazo

@router.get("/", response_model=list[PrazoOut])
async def listar_prazos(
    tribunal: str | None = None,
    db: AsyncSession = Depends(get_db),
    advogado: Advogado = Depends(get_advogado_atual)
):
    query = (
        select(Prazo)
        .join(Processo)
        .where(Processo.advogado_id == advogado.id)
    )
    if tribunal:
        query = query.where(Processo.tribunal == tribunal)

    result = await db.execute(query.order_by(Prazo.data_prazo.asc()))
    return result.scalars().all()

@router.get("/dashboard")
async def dashboard(
    db: AsyncSession = Depends(get_db),
    advogado: Advogado = Depends(get_advogado_atual)
):
    """Prazos de hoje e da semana para o dashboard (RF 2.3 e RF 2.7)."""
    from datetime import date
    hoje = date.today()
    semana = hoje + timedelta(days=7)

    result = await db.execute(
        select(Prazo)
        .join(Processo)
        .where(
            Processo.advogado_id == advogado.id,
            Prazo.status == "pendente",
            Prazo.data_prazo <= semana
        )
        .order_by(Prazo.data_prazo.asc())
    )
    prazos = result.scalars().all()

    return [
        {
            "id": str(p.id),
            "descricao": p.descricao,
            "data_prazo": p.data_prazo.isoformat(),
            "prioridade": p.prioridade,
            "status": p.status,
            "urgente": (p.data_prazo - hoje).days <= 1,  
            "janela": "hoje" if p.data_prazo == hoje else "semana"
        }
        for p in prazos
    ]

@router.patch("/{prazo_id}/status", response_model=PrazoOut)
async def atualizar_status(
    prazo_id: str,
    dados: PrazoStatusUpdate,
    db: AsyncSession = Depends(get_db),
    advogado: Advogado = Depends(get_advogado_atual)
):
    result = await db.execute(
        select(Prazo).join(Processo).where(Prazo.id == prazo_id, Processo.advogado_id == advogado.id)
    )
    prazo = result.scalar_one_or_none()
    if not prazo:
        raise HTTPException(status_code=404, detail="Prazo não encontrado.")

    if dados.status not in ("pendente", "cumprido", "perdido"):
        raise HTTPException(status_code=400, detail="Status inválido.")

    prazo.status = dados.status
    await db.commit()
    await db.refresh(prazo)
    return prazo

@router.delete("/{prazo_id}", status_code=204)
async def excluir_prazo(
    prazo_id: str,
    db: AsyncSession = Depends(get_db),
    advogado: Advogado = Depends(get_advogado_atual)
):
    result = await db.execute(
        select(Prazo).join(Processo).where(Prazo.id == prazo_id, Processo.advogado_id == advogado.id)
    )
    prazo = result.scalar_one_or_none()
    if not prazo:
        raise HTTPException(status_code=404, detail="Prazo não encontrado.")

    await db.delete(prazo)
    await db.commit()