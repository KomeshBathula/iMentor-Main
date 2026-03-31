"""
Python file parser for the iMentor RAG service.
Uses the built-in `ast` module for accurate parsing.
"""
import ast
import os
from dataclasses import dataclass, field
from typing import List, Tuple, Optional


@dataclass
class PyFileInfo:
    rel_path: str
    node_type: str = "python_module"
    # import module names (raw)
    raw_imports: List[str] = field(default_factory=list)
    # resolved relative file paths (for intra-package imports)
    resolved_imports: List[str] = field(default_factory=list)
    # FastAPI route decorators: (method, path, function_name)
    endpoints: List[Tuple[str, str, str]] = field(default_factory=list)
    # Top-level function names
    functions: List[str] = field(default_factory=list)
    # Class names
    classes: List[str] = field(default_factory=list)
    # (caller_func, callee_func) — calls within same file
    internal_calls: List[Tuple[str, str]] = field(default_factory=list)
    # External calls: (object_or_module, method)
    external_calls: List[Tuple[str, str]] = field(default_factory=list)
    # Exported names (top-level that don't start with _)
    public_names: List[str] = field(default_factory=list)
    size_bytes: int = 0


class PyParser:
    """Parse Python files using ast."""

    FASTAPI_METHODS = {"get", "post", "put", "delete", "patch", "options", "head"}
    # Names that indicate it's a service/db call worth tracking
    INTERESTING_CALLEE_PREFIXES = {
        "app", "router", "db", "collection", "neo4j", "redis",
        "qdrant", "client", "session", "conn", "vector_db",
        "ai_core", "llm", "embedding", "model",
    }

    def parse_file(self, abs_path: str, rel_path: str, node_type: str = "python_module") -> Optional[PyFileInfo]:
        try:
            with open(abs_path, "r", encoding="utf-8", errors="ignore") as fh:
                source = fh.read()
        except OSError:
            return None

        try:
            tree = ast.parse(source, filename=abs_path)
        except SyntaxError:
            # Return partial info
            return PyFileInfo(rel_path=rel_path, node_type=node_type, size_bytes=len(source))

        info = PyFileInfo(rel_path=rel_path, node_type=node_type, size_bytes=len(source))
        self._extract(tree, info)
        return info

    def _extract(self, tree: ast.Module, info: PyFileInfo) -> None:
        # ── Imports ───────────────────────────────────────────────────────
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    info.raw_imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    info.raw_imports.append(node.module)

        info.raw_imports = list(dict.fromkeys(info.raw_imports))

        # ── Top-level definitions ─────────────────────────────────────────
        for node in tree.body:
            if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
                info.functions.append(node.name)
                if not node.name.startswith("_"):
                    info.public_names.append(node.name)
                # Check for FastAPI decorator: @app.get('/path')
                for dec in node.decorator_list:
                    self._check_fastapi_decorator(dec, node.name, info)

            elif isinstance(node, ast.ClassDef):
                info.classes.append(node.name)
                if not node.name.startswith("_"):
                    info.public_names.append(node.name)
                # Also check methods within the class
                for item in node.body:
                    if isinstance(item, ast.FunctionDef | ast.AsyncFunctionDef):
                        for dec in item.decorator_list:
                            self._check_fastapi_decorator(dec, item.name, info)

        # ── External calls ────────────────────────────────────────────────
        # Walk entire tree for attribute calls like obj.method(...)
        seen_calls: set = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func = node.func
                if isinstance(func, ast.Attribute):
                    obj = self._get_name(func.value)
                    if obj and any(
                        obj.lower().startswith(p)
                        for p in self.INTERESTING_CALLEE_PREFIXES
                    ):
                        key = (obj, func.attr)
                        if key not in seen_calls:
                            info.external_calls.append(key)
                            seen_calls.add(key)

    def _check_fastapi_decorator(self, dec: ast.expr, func_name: str, info: PyFileInfo) -> None:
        """Extract @app.get('/path') style decorators."""
        if not isinstance(dec, ast.Call):
            return
        func = dec.func
        if not isinstance(func, ast.Attribute):
            return
        method = func.attr.lower()
        if method not in self.FASTAPI_METHODS:
            return
        # Get path from first positional arg
        path = "/"
        if dec.args:
            arg = dec.args[0]
            if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                path = arg.value
        info.endpoints.append((method.upper(), path, func_name))

    @staticmethod
    def _get_name(node: ast.expr) -> Optional[str]:
        """Return the simple name string for a Name node, or None."""
        if isinstance(node, ast.Name):
            return node.id
        if isinstance(node, ast.Attribute):
            parent = PyParser._get_name(node.value)
            if parent:
                return f"{parent}.{node.attr}"
        return None

    def resolve_imports(self, info: PyFileInfo, all_rel_paths: set) -> None:
        """Resolve intra-package imports to file paths."""
        base_dir = os.path.dirname(info.rel_path)
        package_root = base_dir  # e.g., server/rag_service
        resolved = []
        for raw in info.raw_imports:
            # Convert dotted module path to file path
            parts = raw.replace(".", os.sep)
            # Try relative to same directory first
            for root in [package_root, ""]:
                candidate = os.path.normpath(os.path.join(root, parts))
                if candidate + ".py" in all_rel_paths:
                    resolved.append(candidate + ".py")
                    break
                if os.path.join(candidate, "__init__.py") in all_rel_paths:
                    resolved.append(os.path.join(candidate, "__init__.py"))
                    break
            else:
                # Keep as external / stdlib reference
                resolved.append(f"py:{raw}")
        info.resolved_imports = resolved
