"""
Configuration management for the FileTree backend.

Loads settings from YAML and environment variables using Pydantic.
"""

import os
from pathlib import Path
from typing import Optional
import yaml
from pydantic import BaseModel, Field
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


class PathConfig(BaseModel):
    """Path-specific settings."""
    upload_folder: Path = Path("data/uploads")
    user_info_file: Path = Path("data/user_info.json")
    tus_temp_folder: Path = Path("data/tus_temp")
    static_dir: Path = Path("static/dist")


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


class Config(BaseSettings):
    """Global configuration object."""
    server: ServerConfig = ServerConfig()
    paths: PathConfig = PathConfig()
    security: SecurityConfig = SecurityConfig()
    logic: LogicConfig = LogicConfig()

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
