import os
from sqlalchemy import create_engine, Column, String, DateTime, Integer, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Database URL from environment or default
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/audio_instructions"
)

# Create engine
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# Models
class AudioJob(Base):
    __tablename__ = "audio_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(50), unique=True, index=True, nullable=False)
    transcription = Column(Text, nullable=False)
    instruction_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Instruction(Base):
    __tablename__ = "instructions"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(50), index=True, nullable=False)
    instruction_index = Column(Integer, nullable=False)
    instruction_text = Column(Text, nullable=False)
    steps = Column(JSON, nullable=False)  # Store steps as JSON array
    created_at = Column(DateTime, default=datetime.utcnow)


class AudioChunk(Base):
    __tablename__ = "audio_chunks"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(50), index=True, nullable=False)
    instruction_index = Column(Integer, nullable=False)
    step_index = Column(Integer, nullable=False)
    step_text = Column(Text, nullable=False)
    audio_url = Column(String(500), nullable=False)
    s3_key = Column(String(300), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# Create all tables
def init_db():
    Base.metadata.create_all(bind=engine)


# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()