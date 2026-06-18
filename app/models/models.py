import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Date, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
 

class Advogado(Base):
    __tablename__ = "advogados"
 
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    oab: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    reset_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reset_token_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
 
    clientes: Mapped[list["Cliente"]] = relationship("Cliente", back_populates="advogado")
    processos: Mapped[list["Processo"]] = relationship("Processo", back_populates="advogado")
    notificacoes: Mapped[list["Notificacao"]] = relationship("Notificacao", back_populates="advogado")
    movimentacoes: Mapped[list["Movimentacao"]] = relationship("Movimentacao", back_populates="advogado")
 
 

class Cliente(Base):
    __tablename__ = "clientes"
 
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    advogado_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("advogados.id", ondelete="CASCADE"), nullable=False)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    telefone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cpf_cnpj: Mapped[str | None] = mapped_column(String(18), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
 
    advogado: Mapped["Advogado"] = relationship("Advogado", back_populates="clientes")
    processos: Mapped[list["Processo"]] = relationship("Processo", back_populates="cliente")
 
 

class Processo(Base):
    __tablename__ = "processos"
 
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    advogado_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("advogados.id", ondelete="CASCADE"), nullable=False)
    cliente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="RESTRICT"), nullable=False)
    numero_cnj: Mapped[str | None] = mapped_column(String(25), nullable=True)
    vara: Mapped[str | None] = mapped_column(String(100), nullable=True)
    comarca: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tribunal: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ativo")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
 
    advogado: Mapped["Advogado"] = relationship("Advogado", back_populates="processos")
    cliente: Mapped["Cliente"] = relationship("Cliente", back_populates="processos")
    prazos: Mapped[list["Prazo"]] = relationship("Prazo", back_populates="processo")
 
 

class Prazo(Base):
    __tablename__ = "prazos"
 
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    processo_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("processos.id", ondelete="RESTRICT"), nullable=False)
    descricao: Mapped[str] = mapped_column(String(255), nullable=False)
    data_prazo: Mapped[datetime] = mapped_column(Date, nullable=False)
    prioridade: Mapped[str] = mapped_column(String(10), default="media")
    status: Mapped[str] = mapped_column(String(20), default="pendente")
    lembrete_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    arquivo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
 
    processo: Mapped["Processo"] = relationship("Processo", back_populates="prazos")
    notificacoes: Mapped[list["Notificacao"]] = relationship("Notificacao", back_populates="prazo")
    movimentacoes: Mapped[list["Movimentacao"]] = relationship("Movimentacao", back_populates="prazo")
 
 

class Notificacao(Base):
    __tablename__ = "notificacoes"
 
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    advogado_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("advogados.id", ondelete="CASCADE"), nullable=False)
    prazo_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("prazos.id", ondelete="CASCADE"), nullable=False)
    mensagem: Mapped[str] = mapped_column(Text, nullable=False)
    lida: Mapped[bool] = mapped_column(Boolean, default=False)
    enviada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
 
    advogado: Mapped["Advogado"] = relationship("Advogado", back_populates="notificacoes")
    prazo: Mapped["Prazo"] = relationship("Prazo", back_populates="notificacoes")
 
 

class Feriado(Base):
    __tablename__ = "feriados"
 
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    data: Mapped[datetime] = mapped_column(Date, nullable=False)
    descricao: Mapped[str] = mapped_column(String(150), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  
    uf: Mapped[str | None] = mapped_column(String(2), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
 
 

class Movimentacao(Base):
    __tablename__ = "movimentacoes"
 
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prazo_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("prazos.id", ondelete="CASCADE"), nullable=False)
    advogado_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("advogados.id", ondelete="CASCADE"), nullable=False)
    descricao: Mapped[str] = mapped_column(Text, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
 
    prazo: Mapped["Prazo"] = relationship("Prazo", back_populates="movimentacoes")
    advogado: Mapped["Advogado"] = relationship("Advogado", back_populates="movimentacoes")