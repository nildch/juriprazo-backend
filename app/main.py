from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth, prazos
from app.db.database import engine, Base
 
app = FastAPI(
    title="JuriPrazo API",
    description="Sistema de gerenciamento de prazos jurídicos",
    version="1.0.0"
)
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 

app.include_router(auth.router)
app.include_router(prazos.router)
 
@app.get("/")
async def root():
    return {"status": "JuriPrazo API rodando ✓"}