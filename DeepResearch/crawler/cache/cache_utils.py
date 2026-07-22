import json
import pickle
from typing import Any

def serialize_json(data: Any) -> bytes:
    return json.dumps(data).encode('utf-8')

def deserialize_json(data: bytes) -> Any:
    return json.loads(data.decode('utf-8'))

def serialize_pickle(data: Any) -> bytes:
    return pickle.dumps(data)

def deserialize_pickle(data: bytes) -> Any:
    return pickle.loads(data)
