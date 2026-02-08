"""
Configuration management for the FileTree backend.

Loads settings from YAML and environment variables using Pydantic.
"""

import os
from pathlib import Path
from typing import Optional
import yaml
from pydantic import BaseModel, Field, model_validator
from pydantic_settings import (
    BaseSettings, 
    SettingsConfigDict, 
    PydanticBaseSettingsSource
)
from typing import Optional, Tuple, Type


class ServerConfig(BaseModel):
    """Server-specific settings."""
    host: str = "0.0.0.0"
    port: int = 5168
    debug: bool = True
    ssl_cert: Optional[str] = None
    ssl_key: Optional[str] = None



# Define project root relative to this config file (backend/config.py -> backend/ -> root/)
PROJECT_ROOT = Path(__file__).parent.parent.resolve()

class PathConfig(BaseModel):
    """Path-specific settings."""
    upload_folder: Path = Path("data/uploads")
    user_info_file: Path = Path("data/user_info.json")
    tus_temp_folder: Path = Path("data/tus_temp")
    static_dir: Path = PROJECT_ROOT / "static/dist"

    @model_validator(mode='after')
    def resolve_relative_paths(self):
        """Ensure all paths are absolute, resolving relative ones against PROJECT_ROOT."""
        for field_name in self.model_fields:
            value = getattr(self, field_name)
            if isinstance(value, Path) and not value.is_absolute():
                setattr(self, field_name, PROJECT_ROOT / value)
        return self


class SecurityConfig(BaseModel):
    """Security-specific settings."""
    secret_key: str = "your-secret-key-change-in-production"
    master_key: str = "pigstar"  # Default fallback, should be changed
    share_token_expiry_hours: int = 24


class LogicConfig(BaseModel):
    """Business logic specific settings."""
    file_retention_days: int = 30
    max_url_records: int = 30
    max_content_length: Optional[int] = None
    allowed_extensions: Optional[list[str]] = None


class R2Config(BaseModel):
    """Cloudflare R2 storage settings."""
    endpoint_url: str = ""
    access_key_id: str = ""
    secret_access_key: str = ""
    bucket_name: str = ""
    public_domain: str = ""
    threshold_mb: int = 100
    max_concurrent_uploads: int = 5
    max_concurrent_downloads: int = 5
    # Safety limits (Zero Cost Guarantee)
    monthly_limit_gb: int = 9  # Limit to 9GB (Free tier is 10GB)
    monthly_limit_class_a: int = 900000 # Limit to 900k ops (Free tier is 1M)
    monthly_limit_class_b: int = 9000000 # Limit to 9M ops (Free tier is 10M)


class RateLimitConfig(BaseModel):
    """API Rate limiting settings."""
    enabled: bool = True
    login_limit: str = "5/minute"
    admin_limit: str = "10/minute"
    upload_limit: str = "50/minute"
    default_limit: str = "60/minute"
    tus_limit: str = "3000/minute"



class Config(BaseSettings):
    """Global configuration object."""
    server: ServerConfig = ServerConfig()
    paths: PathConfig = PathConfig()
    security: SecurityConfig = SecurityConfig()
    logic: LogicConfig = LogicConfig()
    r2: R2Config = R2Config()
    rate_limit: RateLimitConfig = RateLimitConfig()


    model_config = SettingsConfigDict(
        env_nested_delimiter="__",
        env_file=".env",
        extra="ignore"
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: Type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> Tuple[PydanticBaseSettingsSource, ...]:
        """Reorder settings sources to prioritize environment variables over YAML."""
        return (
            env_settings,
            dotenv_settings,
            init_settings,  # YAML data passed via load() kwargs
            file_secret_settings,
        )

    @classmethod
    def load(cls, yaml_path: Optional[str] = None) -> "Config":
        """Load configuration from YAML and override with environment variables.

        Args:
            yaml_path: Path to the YAML configuration file.

        Returns:
            A populated Config instance.
        """
        if not yaml_path:
            # Default to backend/config.yaml relative to this file
            yaml_path = os.path.join(os.path.dirname(__file__), "config.yaml")

        data = {}
        if os.path.exists(yaml_path):
            with open(yaml_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}

        return cls(**data)


# Singleton instance for the application
settings = Config.load()

# Ensure directories exist
settings.paths.upload_folder.mkdir(parents=True, exist_ok=True)
settings.paths.user_info_file.parent.mkdir(parents=True, exist_ok=True)
settings.paths.tus_temp_folder.mkdir(parents=True, exist_ok=True)
