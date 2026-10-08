from pydantic import BaseModel, Field


class WsFrame(BaseModel):
    type: str = Field(min_length=1, max_length=64)
    payload: dict = Field(default_factory=dict)
