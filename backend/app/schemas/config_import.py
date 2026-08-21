from pydantic import BaseModel


class ConfigImportRequest(BaseModel):
    config: str  # Raw YAML string
    overwrite: bool = False


class ConfigImportEndpoint(BaseModel):
    method: str
    path: str
    name: str
    status_code: int


class ConfigImportResponse(BaseModel):
    success: bool
    models_processed: int
    endpoints_created: list[ConfigImportEndpoint]
    errors: list[str]
