"""Watch service log files for errors, warnings, and tracebacks."""
import os
import re
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from .config import CONTEXT_LINES


# ── data classes ────────────────────────────────────────────
@dataclass
class LogEntry:
    """One line of log output."""
    service: str
    line: str
    timestamp: float
    level: str = "info"          # info | warning | error | critical


@dataclass
class ErrorEvent:
    """A detected error / warning with context."""
    service: str
    level: str                   # warning | error | critical
    message: str
    context_lines: List[str]
    timestamp: float
    category: str = "unknown"    # simple | complex | unknown
    subcategory: str = ""        # e.g. missing_python_module
    source_file: Optional[str] = None
    source_line: Optional[int] = None


# ── patterns ────────────────────────────────────────────────
# (regex, level, subcategory)
_PATTERNS: List[Tuple[str, str, str]] = [
    # ── Python ──
    (r"Traceback \(most recent call last\)",            "error",    "traceback"),
    (r"ModuleNotFoundError: No module named",           "error",    "missing_python_module"),
    (r"ImportError: cannot import name",                "error",    "import_error"),
    (r"SyntaxError:",                                   "error",    "syntax_error"),
    (r"TypeError:",                                     "error",    "type_error"),
    (r"ValueError:",                                    "error",    "value_error"),
    (r"KeyError:",                                      "error",    "key_error"),
    (r"AttributeError:",                                "error",    "attribute_error"),
    (r"FileNotFoundError:",                             "error",    "file_not_found"),
    (r"ConnectionRefusedError:",                        "error",    "connection_refused"),
    (r"PermissionError:",                               "error",    "permission_error"),
    (r"RuntimeError:",                                  "error",    "runtime_error"),
    (r"OSError:",                                       "error",    "os_error"),
    # ── Node.js ──
    (r"Error: Cannot find module",                      "error",    "missing_node_module"),
    (r"EADDRINUSE",                                     "error",    "port_in_use"),
    (r"ECONNREFUSED",                                   "error",    "connection_refused"),
    (r"UnhandledPromiseRejection",                      "error",    "unhandled_promise"),
    (r"SyntaxError: Unexpected token",                  "error",    "js_syntax_error"),
    (r"ReferenceError:",                                "error",    "reference_error"),
    (r"FATAL ERROR",                                    "error",    "fatal"),
    # ── infrastructure ──
    (r"Failed to initialize Neo4j",                     "error",    "neo4j_connection"),
    (r"Neo4j.*Connection refused",                      "error",    "neo4j_connection"),
    (r"Qdrant.*Connection refused",                     "error",    "qdrant_connection"),
    (r"Redis.*ECONNREFUSED",                            "error",    "redis_connection"),
    (r"CRITICAL",                                       "critical", "critical"),
    # ── warnings ──
    (r"DeprecationWarning:",                            "warning",  "deprecation"),
    (r"UserWarning:",                                   "warning",  "user_warning"),
    (r"FutureWarning:",                                 "warning",  "future_warning"),
    # generic (checked last)
    (r"\bWARNING\b",                                    "warning",  "warning"),
    (r"\bERROR\b",                                      "error",    "generic_error"),
]

SIMPLE_SUBCATS = {
    "missing_python_module", "missing_node_module", "port_in_use",
    "file_not_found", "permission_error", "syntax_error",
    "js_syntax_error", "import_error", "deprecation",
    "key_error", "type_error", "value_error", "attribute_error",
}
COMPLEX_SUBCATS = {
    "neo4j_connection", "qdrant_connection", "redis_connection",
    "connection_refused", "fatal", "critical", "runtime_error",
    "unhandled_promise", "os_error",
}


# ── watcher ─────────────────────────────────────────────────
class LogWatcher:
    """Incrementally reads log files, detects errors and warnings."""

    def __init__(self, log_files: Dict[str, str]):
        self.log_files = log_files
        self._pos: Dict[str, int] = {}
        self._ctx: Dict[str, List[str]] = {s: [] for s in log_files}
        self._tb_active: Dict[str, bool] = {s: False for s in log_files}
        self._tb_buf: Dict[str, List[str]] = {s: [] for s in log_files}
        self._compiled = [
            (re.compile(p, re.IGNORECASE), lv, sc)
            for p, lv, sc in _PATTERNS
        ]

        # Seek to end so we only see *new* output
        for svc, path in self.log_files.items():
            try:
                self._pos[svc] = os.path.getsize(path) if os.path.exists(path) else 0
            except OSError:
                self._pos[svc] = 0

    # ────────────────────────────────────────────────────────
    def scan(self) -> Tuple[List[LogEntry], List[ErrorEvent]]:
        """Return (new_lines, new_errors) since last call."""
        lines_out: List[LogEntry] = []
        errors_out: List[ErrorEvent] = []

        for svc, path in self.log_files.items():
            if not os.path.exists(path):
                continue
            try:
                size = os.path.getsize(path)
                if size < self._pos.get(svc, 0):
                    self._pos[svc] = 0          # file was truncated / rotated
                if size == self._pos.get(svc, 0):
                    continue

                with open(path, "r", errors="replace") as fh:
                    fh.seek(self._pos.get(svc, 0))
                    raw = fh.read()
                    self._pos[svc] = fh.tell()

                for line in raw.splitlines():
                    line = line.rstrip()
                    if not line:
                        continue

                    # context ring-buffer
                    ctx = self._ctx[svc]
                    ctx.append(line)
                    if len(ctx) > CONTEXT_LINES:
                        self._ctx[svc] = ctx[-CONTEXT_LINES:]

                    # ── multi-line traceback handling ──
                    if "Traceback (most recent call last)" in line:
                        self._tb_active[svc] = True
                        self._tb_buf[svc] = [line]
                        continue

                    if self._tb_active[svc]:
                        self._tb_buf[svc].append(line)
                        if re.match(
                            r"^\w+(Error|Exception|Warning):", line
                        ):
                            self._tb_active[svc] = False
                            ev = self._classify_traceback(
                                svc, line, self._tb_buf[svc]
                            )
                            if ev:
                                errors_out.append(ev)
                        continue

                    # ── single-line check ──
                    entry = LogEntry(
                        service=svc, line=line, timestamp=time.time()
                    )
                    ev = self._classify_line(svc, line)
                    if ev:
                        errors_out.append(ev)

                    # set display level
                    up = line.upper()
                    if any(k in up for k in ("ERROR", "CRITICAL", "FATAL")):
                        entry.level = "error"
                    elif "WARN" in up:
                        entry.level = "warning"

                    lines_out.append(entry)

            except OSError:
                continue

        return lines_out, errors_out

    # ── internal helpers ────────────────────────────────────
    def _classify_line(self, svc: str, line: str) -> Optional[ErrorEvent]:
        for pat, lvl, subcat in self._compiled:
            if subcat == "traceback":
                continue
            if pat.search(line):
                return self._make_event(svc, lvl, subcat, line,
                                        list(self._ctx[svc]))
        return None

    def _classify_traceback(
        self, svc: str, error_line: str, tb_lines: List[str]
    ) -> Optional[ErrorEvent]:
        for pat, lvl, subcat in self._compiled:
            if subcat == "traceback":
                continue
            if pat.search(error_line):
                src, sln = None, None
                for tl in reversed(tb_lines):
                    m = re.search(r'File "([^"]+)", line (\d+)', tl)
                    if m:
                        src, sln = m.group(1), int(m.group(2))
                        break
                return self._make_event(
                    svc, lvl, subcat, error_line, tb_lines, src, sln
                )
        return None

    @staticmethod
    def _make_event(
        svc: str, lvl: str, subcat: str, msg: str,
        ctx: List[str],
        src_file: Optional[str] = None,
        src_line: Optional[int] = None,
    ) -> ErrorEvent:
        if subcat in SIMPLE_SUBCATS:
            cat = "simple"
        elif subcat in COMPLEX_SUBCATS:
            cat = "complex"
        else:
            cat = "unknown"

        return ErrorEvent(
            service=svc,
            level=lvl,
            message=msg,
            context_lines=ctx,
            timestamp=time.time(),
            category=cat,
            subcategory=subcat,
            source_file=src_file,
            source_line=src_line,
        )
