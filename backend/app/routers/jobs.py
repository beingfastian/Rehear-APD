"""Read and delete processed jobs."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import jobs

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("")
def list_jobs(db: Session = Depends(get_db)):
    return {"jobs": jobs.list_jobs(db)}


@router.get("/{job_id}")
def get_job(job_id: str, db: Session = Depends(get_db)):
    details = jobs.get_job_details(db, job_id)
    if details is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return details


@router.delete("/{job_id}")
def delete_job(job_id: str, db: Session = Depends(get_db)):
    try:
        deleted = jobs.delete_job(db, job_id)
    except Exception as exc:
        db.rollback()
        logger.exception("Deleting job %s failed", job_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not deleted:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job deleted successfully", "job_id": job_id}
