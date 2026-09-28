"""Rehear APD API entry point.

    uvicorn main:app --host 0.0.0.0 --port 10000
"""

from app.factory import create_app

app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=10000)
