from pydantic import BaseModel, Field
from typing import List

class EmbeddingModel(BaseModel):
    vector: List[float] = Field(..., description="Vector floating point arrays")
    dimension: int = Field(..., description="Embedding dimensionality")
    model_name: str = Field(..., description="Name of generator model")
