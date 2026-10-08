import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    database_url: str
    cors_origins: tuple[str, ...]
    jwt_secret: str
    otp_code: str
    upload_dir: Path
    max_upload_bytes: int
    testing: bool


def load_settings() -> Settings:
    origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000')
    return Settings(
        database_url=os.getenv('DATABASE_URL', 'sqlite:///./signal.db'),
        cors_origins=tuple(origin.strip() for origin in origins.split(',') if origin.strip()),
        jwt_secret=os.getenv('JWT_SECRET', 'local-development-secret-change-me'),
        otp_code=os.getenv('OTP_CODE', '123456'),
        upload_dir=Path(os.getenv('UPLOAD_DIR', 'uploads')),
        max_upload_bytes=int(os.getenv('MAX_UPLOAD_BYTES', str(10 * 1024 * 1024))),
        testing=os.getenv('TESTING') == '1',
    )


settings = load_settings()
