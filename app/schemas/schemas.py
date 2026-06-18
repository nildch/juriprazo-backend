from pydantic import BaseModel, EmailStr
from datetime import date, datetime
from uuid import UUID
from typing import Optional
 
class AdvogadoCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    oab: str
 
class AdvogadoOut(BaseModel):
    id: UUID
    nome: str
    email: str
    oab: str
    criado_em: datetime
    model_config = {"from_attributes": True}
 
class LoginInput(BaseModel):
    email: EmailStr
    senha: str
 
class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
 
class RecuperarSenhaInput(BaseModel):
    email: EmailStr
 
class RedefinirSenhaInput(BaseModel):
    token: str
    nova_senha: str
 
class ClienteCreate(BaseModel):
    nome: str
    email: Optional[str] = None
    telefone: Optional[str] = None
    cpf_cnpj: Optional[str] = None
 
class ClienteOut(BaseModel):
    id: UUID
    advogado_id: UUID
    nome: str
    email: Optional[str]
    telefone: Optional[str]
    cpf_cnpj: Optional[str]
    criado_em: datetime
    model_config = {"from_attributes": True}
 

class ProcessoCreate(BaseModel):
    cliente_id: UUID
    numero_cnj: Optional[str] = None
    vara: Optional[str] = None
    comarca: Optional[str] = None
    tribunal: Optional[str] = None
 
class ProcessoOut(BaseModel):
    id: UUID
    advogado_id: UUID
    cliente_id: UUID
    numero_cnj: Optional[str]
    vara: Optional[str]
    comarca: Optional[str]
    tribunal: Optional[str]
    status: str
    criado_em: datetime
    model_config = {"from_attributes": True}
 
class PrazoCreate(BaseModel):
    processo_id: UUID
    descricao: str
    data_inicio: date
    dias_uteis: int
    prioridade: str = "media"
 
class PrazoOut(BaseModel):
    id: UUID
    processo_id: UUID
    descricao: str
    data_prazo: date
    prioridade: str
    status: str
    lembrete_em: Optional[datetime]
    arquivo_url: Optional[str]
    criado_em: datetime
    model_config = {"from_attributes": True}
 
class PrazoStatusUpdate(BaseModel):
    status: str  
 
class NotificacaoOut(BaseModel):
    id: UUID
    prazo_id: UUID
    mensagem: str
    lida: bool
    enviada_em: datetime
    model_config = {"from_attributes": True}

class FeriadoCreate(BaseModel):
    data: date
    descricao: str
    tipo: str  
    uf: Optional[str] = None
 
class FeriadoOut(BaseModel):
    id: UUID
    data: date
    descricao: str
    tipo: str
    uf: Optional[str]
    model_config = {"from_attributes": True}
 
class MovimentacaoCreate(BaseModel):
    descricao: str
 
class MovimentacaoOut(BaseModel):
    id: UUID
    prazo_id: UUID
    advogado_id: UUID
    descricao: str
    criado_em: datetime
    model_config = {"from_attributes": True}