"""Small versioned SQLite store. JSON documents retain evidence without schema guessing."""
import os
from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy import create_engine, String, Text, Integer, UniqueConstraint, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

DATA = Path(os.getenv('PHANTOM_DATA', Path(__file__).resolve().parents[1] / 'data')).resolve()
DATA.mkdir(parents=True, exist_ok=True)
ARTIFACTS = DATA / 'artifacts'
ARTIFACTS.mkdir(exist_ok=True)
engine = create_engine(f'sqlite:///{DATA / "laboratory.sqlite"}', connect_args={'check_same_thread': False, 'timeout': 30})
@event.listens_for(engine, 'connect')
def pragmas(connection, _):
    connection.execute('PRAGMA journal_mode=WAL')
    connection.execute('PRAGMA foreign_keys=ON')
Session = sessionmaker(engine, expire_on_commit=False)
def now():
    return datetime.now(timezone.utc).isoformat()
class Base(DeclarativeBase):
    pass
class Record(Base):
    __tablename__ = 'records'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    kind: Mapped[str] = mapped_column(String, index=True)
    body: Mapped[str] = mapped_column(Text)
    updated: Mapped[str] = mapped_column(String, default=now)
class Order(Base):
    __tablename__ = 'orders'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    release: Mapped[str] = mapped_column(String)
    session: Mapped[str] = mapped_column(String, index=True)
    checkout_key: Mapped[str] = mapped_column(String)
    total_cents: Mapped[int] = mapped_column(Integer)
    created: Mapped[str] = mapped_column(String, default=now)
    __table_args__ = (UniqueConstraint('release', 'session', 'checkout_key'),)
class Migration(Base):
    __tablename__ = 'schema_migrations'
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    applied: Mapped[str] = mapped_column(String, default=now)

import json
def init():
    with engine.begin() as connection:
        Migration.__table__.create(connection, checkfirst=True)
        applied = set(connection.execute(Migration.__table__.select()).scalars())
        for path in sorted((Path(__file__).parent / 'migrations').glob('*.sql')):
            version = int(path.name.split('_')[0])
            if version in applied:
                continue
            for statement in path.read_text(encoding='utf-8').split(';'):
                if statement.strip():
                    connection.exec_driver_sql(statement)
            connection.execute(Migration.__table__.insert().values(version=version, applied=now()))
def put(kind, key, body):
    with Session.begin() as db:
        row = db.get(Record, key)
        if row:
            row.body, row.updated = json.dumps(body), now()
        else:
            db.add(Record(id=key, kind=kind, body=json.dumps(body)))
    return body
def get(key):
    with Session() as db:
        row = db.get(Record, key)
        return json.loads(row.body) if row else None
def listing(kind):
    with Session() as db:
        rows = db.query(Record).filter_by(kind=kind).order_by(Record.updated.desc()).all()
        return [json.loads(row.body) for row in rows]
