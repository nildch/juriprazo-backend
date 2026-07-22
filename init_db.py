from helpers.database import get_conn

SQL = """
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS advogados (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome               VARCHAR(150) NOT NULL,
    email              VARCHAR(150) NOT NULL UNIQUE,
    senha_hash         VARCHAR(255) NOT NULL,
    oab                VARCHAR(20)  NOT NULL UNIQUE,
    reset_token        VARCHAR(255),
    reset_token_expiry TIMESTAMP,
    criado_em          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advogado_id UUID NOT NULL REFERENCES advogados(id) ON DELETE CASCADE,
    nome        VARCHAR(150) NOT NULL,
    email       VARCHAR(150),
    telefone    VARCHAR(20),
    cpf_cnpj    VARCHAR(18),
    criado_em   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advogado_id UUID NOT NULL REFERENCES advogados(id) ON DELETE CASCADE,
    cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    numero_cnj  VARCHAR(25),
    vara        VARCHAR(100),
    comarca     VARCHAR(100),
    tribunal    VARCHAR(20),
    status      VARCHAR(20) DEFAULT 'ativo',
    criado_em   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feriados (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data      DATE NOT NULL,
    descricao VARCHAR(150) NOT NULL,
    tipo      VARCHAR(20) NOT NULL,
    uf        CHAR(2),
    criado_em TIMESTAMP DEFAULT NOW(),
    UNIQUE (data, uf, tipo)
);

CREATE TABLE IF NOT EXISTS prazos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE RESTRICT,
    descricao   VARCHAR(255) NOT NULL,
    data_prazo  DATE NOT NULL,
    prioridade  VARCHAR(10) DEFAULT 'media',
    status      VARCHAR(20) DEFAULT 'pendente',
    lembrete_em TIMESTAMP,
    arquivo_url VARCHAR(500),
    criado_em   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notificacoes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advogado_id UUID NOT NULL REFERENCES advogados(id) ON DELETE CASCADE,
    prazo_id    UUID NOT NULL REFERENCES prazos(id)    ON DELETE CASCADE,
    mensagem    TEXT NOT NULL,
    lida        BOOLEAN DEFAULT FALSE,
    enviada_em  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movimentacoes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prazo_id    UUID NOT NULL REFERENCES prazos(id)    ON DELETE CASCADE,
    advogado_id UUID NOT NULL REFERENCES advogados(id) ON DELETE CASCADE,
    descricao   TEXT NOT NULL,
    criado_em   TIMESTAMP DEFAULT NOW()
);

-- Feriados nacionais 2025
INSERT INTO feriados (data, descricao, tipo) VALUES
    ('2025-01-01', 'Confraternização Universal', 'nacional'),
    ('2025-04-18', 'Sexta-feira Santa',           'nacional'),
    ('2025-04-21', 'Tiradentes',                  'nacional'),
    ('2025-05-01', 'Dia do Trabalhador',           'nacional'),
    ('2025-09-07', 'Independência do Brasil',      'nacional'),
    ('2025-10-12', 'Nossa Senhora Aparecida',      'nacional'),
    ('2025-11-02', 'Finados',                      'nacional'),
    ('2025-11-15', 'Proclamação da República',     'nacional'),
    ('2025-12-25', 'Natal',                        'nacional')
ON CONFLICT DO NOTHING;
"""

conn = None
try:
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute(SQL)
    conn.commit()
    print("✓ Banco inicializado com sucesso!")
except Exception as e:
    print(f"✗ Erro: {e}")
finally:
    if conn:
        conn.close()