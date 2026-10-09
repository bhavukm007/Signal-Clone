import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    database_url: str
    cors_origins: tuple[str, ...]
    otp_code: str
    upload_dir: Path
    max_upload_bytes: int
    testing: bool
    environment: str
    jwt_secret: str


def load_settings() -> Settings:
    origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000')
    environment = os.getenv('ENVIRONMENT', 'development').strip().lower()
    jwt_secret = os.getenv('JWT_SECRET', '').strip()
    if environment == 'production' and (
        len(jwt_secret) < 32
        or len(set(jwt_secret)) < 12
        or jwt_secret.lower().startswith(('change-me', 'replace-me', 'your-secret'))
    ):
        raise RuntimeError('Production requires a unique random JWT_SECRET of at least 32 characters')
    return Settings(
        database_url=os.getenv('DATABASE_URL', 'sqlite:///./signal.db'),
        cors_origins=tuple(origin.strip() for origin in origins.split(',') if origin.strip()),
        otp_code=os.getenv('OTP_CODE', '123456'),
        upload_dir=Path(os.getenv('UPLOAD_DIR', 'uploads')),
        max_upload_bytes=int(os.getenv('MAX_UPLOAD_BYTES', str(10 * 1024 * 1024))),
        testing=os.getenv('TESTING') == '1',
        environment=environment,
        jwt_secret=jwt_secret,
    )


settings = load_settings()
