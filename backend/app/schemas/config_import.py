from pydantic import AliasChoices, BaseModel, Field


class ConfigImportRequest(BaseModel):
    # Raw YAML string. Accepts "yaml_content" as well as "config": the UI sent
    # the former while this model only allowed the latter, so every import
    # failed with "Field required". Keeping both means older clients still work.
    config: str = Field(validation_alias=AliasChoices("config", "yaml_content"))
    overwrite: bool = False

    model_config = {"populate_by_name": True}


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
