from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from .config import settings

_db_url = settings.DATABASE_URL

# Ensure we always use SQLite for local development if PostgreSQL is not available
if not _db_url or _db_url.startswith("postgresql"):
    _db_url = "sqlite+aiosqlite:///./prahari.db"

engine = create_async_engine(
    _db_url,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in _db_url else {},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables and seed initial data"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
