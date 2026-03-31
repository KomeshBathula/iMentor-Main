"""
JavaScript / JSX parser for the iMentor codebase.
Uses regex-based extraction tuned to the Express + React patterns used here.
No external AST library needed.
"""
import re
import os
from dataclasses import dataclass, field
from typing import List, Tuple, Optional


# ── Compiled patterns ────────────────────────────────────────────────────

# ES6 import:  import X from './path'  |  import { X, Y } from './path'
_RE_IMPORT_FROM = re.compile(
    r"""import\s+(?:[\w*{},\s]+)\s+from\s+['"]([^'"]+)['"]""", re.MULTILINE
)
# CJS require:  require('./path')  |  const X = require('./path')
_RE_REQUIRE = re.compile(r"""require\s*\(\s*['"]([^'"]+)['"]\s*\)""")

# Express route defs:  router.get('/path', ...handlers)
_RE_ROUTE = re.compile(
    r"""(?:router|app)\s*\.\s*(get|post|put|delete|patch|use|all)\s*\(\s*['"`]([^'"`]*)['"`]""",
    re.IGNORECASE,
)

# app.use('/prefix', routerVar) — mounts a sub-router
_RE_MOUNT = re.compile(
    r"""app\s*\.\s*use\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)""",
    re.IGNORECASE,
)

# Function/const arrow definitions at file level (captures name)
_RE_FUNC_DEF = re.compile(
    r"""^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(|"""
    r"""^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(|"""
    r"""^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function""",
    re.MULTILINE,
)

# Class definition
_RE_CLASS = re.compile(r"""class\s+(\w+)\s*(?:extends\s+\w+\s*)?\{""", re.MULTILINE)

# module.exports / export default / export const
_RE_EXPORT = re.compile(
    r"""module\.exports\s*=\s*(\w+)|"""
    r"""exports\.(\w+)\s*=|"""
    r"""export\s+default\s+(?:class\s+|function\s+)?(\w+)|"""
    r"""export\s+(?:const|let|var|function|class)\s+(\w+)""",
    re.MULTILINE,
)

# Service/orchestrator/handler usage patterns:
# somethingService.method(  OR  await serviceName.call(
_RE_SERVICE_CALL = re.compile(
    r"""(?:await\s+)?(\w*(?:Service|Orchestrator|Handler|Manager|Router|Cache|Client))\s*\.\s*(\w+)\s*\(""",
    re.IGNORECASE,
)

# Direct constructor:  new SomeService(
_RE_NEW_CALL = re.compile(r"""new\s+(\w+)\s*\(""")

# Variable bound to a require():  const agentService = require('...')
# Used to track which variable name maps to which module
_RE_REQUIRE_BINDING = re.compile(
    r"""(?:const|let|var)\s+\{?\s*(\w+)\s*\}?\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)"""
)

# Strip single-line comments and obvious strings to reduce false positives
_RE_LINE_COMMENT = re.compile(r"""//.*$""", re.MULTILINE)
_RE_BLOCK_COMMENT = re.compile(r"""/\*.*?\*/""", re.DOTALL)
_RE_TEMPLATE_LITERAL = re.compile(r"""`[^`]*`""", re.DOTALL)


# ── Data model ───────────────────────────────────────────────────────────

@dataclass
class JSFileInfo:
    rel_path: str
    node_type: str = "default"
    # raw module specifiers (before path resolution)
    raw_imports: List[str] = field(default_factory=list)
    # resolved relative file paths (from repo root)
    resolved_imports: List[str] = field(default_factory=list)
    # (variable_name, module_path) — who gets assigned to what
    require_bindings: List[Tuple[str, str]] = field(default_factory=list)
    # Express routes defined in this file
    routes: List[Tuple[str, str]] = field(default_factory=list)  # (method, path)
    # Sub-router mounts: (prefix, var_name)
    mounts: List[Tuple[str, str]] = field(default_factory=list)
    # Names of functions/classes defined here
    functions: List[str] = field(default_factory=list)
    classes: List[str] = field(default_factory=list)
    exports: List[str] = field(default_factory=list)
    # (service_var_name, method_name) calls
    service_calls: List[Tuple[str, str]] = field(default_factory=list)
    # constructor calls: new X()
    new_calls: List[str] = field(default_factory=list)
    # raw source (kept for post-processing if needed)
    size_bytes: int = 0


# ── Parser ───────────────────────────────────────────────────────────────

class JSParser:
    """Stateless parser — call parse_file() for each JS/JSX file."""

    def parse_file(self, abs_path: str, rel_path: str, node_type: str = "default") -> Optional[JSFileInfo]:
        try:
            with open(abs_path, "r", encoding="utf-8", errors="ignore") as fh:
                source = fh.read()
        except OSError:
            return None

        info = JSFileInfo(rel_path=rel_path, node_type=node_type, size_bytes=len(source))

        # Strip comments for cleaner regex matching
        clean = _RE_BLOCK_COMMENT.sub(" ", source)
        clean = _RE_LINE_COMMENT.sub("", clean)

        # ── Imports ──────────────────────────────────────────────────────
        for m in _RE_IMPORT_FROM.finditer(clean):
            info.raw_imports.append(m.group(1))
        for m in _RE_REQUIRE.finditer(clean):
            info.raw_imports.append(m.group(1))

        # Deduplicate
        info.raw_imports = list(dict.fromkeys(info.raw_imports))

        # ── Require bindings (var → module) ──────────────────────────────
        for m in _RE_REQUIRE_BINDING.finditer(clean):
            info.require_bindings.append((m.group(1), m.group(2)))

        # ── Routes ───────────────────────────────────────────────────────
        for m in _RE_ROUTE.finditer(clean):
            method = m.group(1).upper()
            path = m.group(2)
            if path:  # skip bare app.use(middleware) with no path
                info.routes.append((method, path))

        # ── Mounts ───────────────────────────────────────────────────────
        for m in _RE_MOUNT.finditer(clean):
            info.mounts.append((m.group(1), m.group(2)))

        # ── Function / class definitions ─────────────────────────────────
        for m in _RE_FUNC_DEF.finditer(clean):
            name = m.group(1) or m.group(2) or m.group(3)
            if name and name not in ("if", "for", "while", "switch"):
                info.functions.append(name)

        for m in _RE_CLASS.finditer(clean):
            info.classes.append(m.group(1))

        # ── Exports ──────────────────────────────────────────────────────
        for m in _RE_EXPORT.finditer(clean):
            name = m.group(1) or m.group(2) or m.group(3) or m.group(4)
            if name:
                info.exports.append(name)

        # ── Service calls ─────────────────────────────────────────────────
        seen_calls: set = set()
        for m in _RE_SERVICE_CALL.finditer(clean):
            key = (m.group(1), m.group(2))
            if key not in seen_calls:
                info.service_calls.append(key)
                seen_calls.add(key)

        # ── new X() calls ─────────────────────────────────────────────────
        for m in _RE_NEW_CALL.finditer(clean):
            info.new_calls.append(m.group(1))

        return info

    # ── Path resolution ──────────────────────────────────────────────────

    def resolve_imports(self, info: JSFileInfo, all_rel_paths: set) -> None:
        """
        Resolve raw import specifiers to relative-from-repo-root paths.
        Populates info.resolved_imports in-place.
        """
        base_dir = os.path.dirname(info.rel_path)
        resolved = []
        for raw in info.raw_imports:
            if not raw.startswith("."):
                # npm package — keep as-is prefixed with "npm:"
                resolved.append(f"npm:{raw}")
                continue
            # Normalize the path
            joined = os.path.normpath(os.path.join(base_dir, raw))
            # Try exact match, then with extensions
            if joined in all_rel_paths:
                resolved.append(joined)
                continue
            found = False
            for ext in (".js", ".jsx", ".mjs", "/index.js", "/index.jsx"):
                candidate = joined + ext
                if candidate in all_rel_paths:
                    resolved.append(candidate)
                    found = True
                    break
            if not found:
                # Best-effort: keep normalized path even if not confirmed
                resolved.append(joined)
        info.resolved_imports = resolved
