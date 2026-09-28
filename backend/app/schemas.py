"""Request bodies accepted by the API."""

from typing import Optional

from pydantic import BaseModel


class TextSubmission(BaseModel):
    text: str


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str


class ForgotPasswordRequest(BaseModel):
    email: str


class VerifyOtpRequest(BaseModel):
    email: str
    otp: str


class VerifyResetCodeRequest(BaseModel):
    email: str
    code: str


class ResetPasswordRequest(BaseModel):
    email: Optional[str] = None
    code: Optional[str] = None
    reset_token: Optional[str] = None
    new_password: str
