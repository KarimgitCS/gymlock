from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, data, sync

app = FastAPI(title="GymLock API")

# The client is a static site and phone app that authenticate with a bearer token (no cookies),
# so any origin may call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sync.router)
app.include_router(data.router)


@app.get("/health")
def health():
    return {"status": "ok"}
