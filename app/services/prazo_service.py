from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import Feriado

async def calcular_data_prazo(
    data_inicio: date,
    dias_uteis: int,
    db: AsyncSession,
    uf: str | None = None
) -> date:
    """
    Soma 'dias_uteis' dias úteis a partir de 'data_inicio',
    ignorando finais de semana e feriados cadastrados.
    """
   
    query = select(Feriado.data)
    feriados_result = await db.execute(query)
    feriados = {row[0] for row in feriados_result.fetchall()
                if row[0].uf is None or row[0].uf == uf}

    
    query_datas = select(Feriado.data).where(
        (Feriado.uf == None) | (Feriado.uf == uf)
    )
    result = await db.execute(query_datas)
    datas_feriado = {row[0] for row in result.fetchall()}

    data_atual = data_inicio
    dias_contados = 0

    while dias_contados < dias_uteis:
        data_atual += timedelta(days=1)
        
        if data_atual.weekday() >= 5:
            continue
       
        if data_atual in datas_feriado:
            continue
        dias_contados += 1

    return data_atual