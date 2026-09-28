import json

from app.models import AudioChunk, AudioJob, Instruction


def create_job(client, fake_openai, instructions=("Open your book", "Close your book")):
    fake_openai.chat_content = json.dumps(list(instructions))
    return client.post("/process-live-text", json={"text": "open your book then close your book"}).json()["job_id"]


def test_list_jobs_newest_first(client, fake_openai):
    first = create_job(client, fake_openai)
    second = create_job(client, fake_openai)

    jobs = client.get("/jobs").json()["jobs"]

    assert {job["job_id"] for job in jobs} == {first, second}
    assert set(jobs[0]) == {"job_id", "transcription", "instruction_count", "created_at"}
    assert jobs[0]["created_at"] >= jobs[1]["created_at"]


def test_get_job_details(client, fake_openai):
    job_id = create_job(client, fake_openai)

    body = client.get(f"/jobs/{job_id}").json()

    assert body["job"]["instruction_count"] == 2
    assert [i["instruction_text"] for i in body["instructions"]] == ["Open your book", "Close your book"]
    assert body["instructions"][0]["steps"] == ["Open your book"]
    assert [(c["instruction_index"], c["step_index"]) for c in body["audio_chunks"]] == [(0, 0), (1, 0)]
    assert body["audio_chunks"][1]["s3_key"] == f"tts/{job_id}/instruction_1.mp3"


def test_get_unknown_job_returns_404(client):
    response = client.get("/jobs/job_missing")
    assert response.status_code == 404
    assert response.json()["detail"] == "Job not found"


def test_delete_job_removes_rows_and_audio(client, db, fake_openai, fake_s3):
    job_id = create_job(client, fake_openai)
    other_id = create_job(client, fake_openai, ["Sit down please"])

    response = client.delete(f"/jobs/{job_id}")

    assert response.json() == {"message": "Job deleted successfully", "job_id": job_id}
    assert sorted(fake_s3.deleted) == [f"tts/{job_id}/instruction_0.mp3", f"tts/{job_id}/instruction_1.mp3"]
    for model in (AudioJob, Instruction, AudioChunk):
        assert db.query(model).filter_by(job_id=job_id).count() == 0
    assert db.query(AudioJob).filter_by(job_id=other_id).count() == 1


def test_delete_survives_s3_errors(client, db, fake_openai, fake_s3, monkeypatch):
    job_id = create_job(client, fake_openai)

    def broken(**kwargs):
        raise RuntimeError("s3 down")

    monkeypatch.setattr(fake_s3, "delete_object", broken)

    assert client.delete(f"/jobs/{job_id}").status_code == 200
    assert db.query(AudioJob).count() == 0


def test_delete_unknown_job_returns_404(client):
    assert client.delete("/jobs/job_missing").status_code == 404
