from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.user import UserOut


class OtpRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=120)


class OtpVerify(BaseModel):
    identifier: str = Field(min_length=3, max_length=120)
    code: str = Field(min_length=4, max_length=16)


class AuthResult(BaseModel):
    token: str
    user: UserOut
    is_new_user: bool


class OtpAccepted(BaseModel):
    ok: bool = True
    hint: str
