"""Lazily-constructed third-party clients (OpenAI, S3).

Built on first use so that importing the app never requires credentials,
and so tests can swap them out with ``monkeypatch``.
"""

from functools import lru_cache

import boto3
from openai import AsyncOpenAI, OpenAI

from app.config import get_settings


@lru_cache
def get_openai_client() -> OpenAI:
    return OpenAI(api_key=get_settings().openai_api_key)


@lru_cache
def get_async_openai_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=get_settings().openai_api_key)


@lru_cache
def get_s3_client():
    settings = get_settings()
    return boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region,
    )
