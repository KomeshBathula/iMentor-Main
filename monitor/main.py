"""iMentor Service Monitor – interactive TUI entry-point.

Run with:  python -m monitor.main [OPTIONS]
"""
import argparse
import os
import sys
import time
from datetime import datetime

try:
    from rich.console import Console
    from rich.markdown import Markdown
    from rich.panel import Panel
    from rich.prompt import Confirm, IntPrompt, Prompt
    from rich.table import Table
except ImportError:
    sys.exit(
        "ERROR: 'rich' library is required.\n"
        "Install it with:  pip install rich"
    )

from .ai_client import AIClient
from .config import (
    DEDUP_WINDOW_SECS,
    GEMINI_MODELS,
    LOG_FILES,
    OLLAMA_BASE_URL,
    SCAN_INTERVAL,
    SERVICE_COLORS,
)
from .error_handler import SYSTEM_PROMPT, ErrorHandler
from .log_watcher import ErrorEvent, LogWatcher

console = Console()

# ── runtime counters ────────────────────────────────────────
_stats = {
    "errors": 0,
    "warnings": 0,
    "fixes_applied": 0,
    "lines": 0,
}
_seen: dict[str, float] = {}


# ════════════════════════════════════════════════════════════
#  CLI
# ════════════════════════════════════════════════════════════
def _parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="iMentor Service Monitor")
    ap.add_argument(
        "--provider", choices=["gemini", "ollama"],
        help="AI provider (interactive menu if omitted)",
    )
    ap.add_argument("--model", help="Model name")
    ap.add_argument(
        "--auto-fix", action="store_true",
        help="Automatically apply quick-fixes for simple errors",
    )
    return ap.parse_args()


# ════════════════════════════════════════════════════════════
#  Model selection
# ════════════════════════════════════════════════════════════
def _select_model() -> tuple[str, str]:
    """Interactive provider + model picker.  Returns (provider, model)."""
    console.print()
    console.print(
        Panel.fit(
            "[bold cyan]  iMentor Service Monitor  [/]\n"
            "[dim]AI-Powered Error Detection & Auto-Correction[/]",
            border_style="cyan",
        )
    )
    console.print()

    # ── provider ──
    console.print("[bold]Select AI Provider:[/]")
    console.print("  [cyan]1.[/] Gemini  (Google AI – cloud)")
    console.print("  [green]2.[/] Ollama  (local models)")
    console.print()
    choice = Prompt.ask("Provider", choices=["1", "2"], default="1")

    if choice == "1":
        provider = "gemini"
        key = os.environ.get("GEMINI_API_KEY", "")
        if not key:
            console.print(
                "[red]⚠  GEMINI_API_KEY not set![/]  "
                "Export it or add to .env"
            )
            sys.exit(1)
        console.print("\n[bold]Gemini models:[/]")
        for i, m in enumerate(GEMINI_MODELS, 1):
            tag = " [dim](default)[/]" if i == 1 else ""
            console.print(f"  [cyan]{i}.[/] {m}{tag}")
        idx = IntPrompt.ask("Model #", default=1)
        model = GEMINI_MODELS[max(0, min(idx - 1, len(GEMINI_MODELS) - 1))]
    else:
        provider = "ollama"
        console.print(f"\n[dim]Fetching models from {OLLAMA_BASE_URL} …[/]")
        models = AIClient.get_ollama_models()
        if not models:
            console.print("[yellow]⚠  No models found or server unreachable.[/]")
            model = Prompt.ask("Enter model name manually", default="llama3")
        else:
            console.print("\n[bold]Ollama models:[/]")
            for i, m in enumerate(models, 1):
                console.print(f"  [green]{i}.[/] {m}")
            idx = IntPrompt.ask("Model #", default=1)
            model = models[max(0, min(idx - 1, len(models) - 1))]

    console.print(f"\n[bold green]✓  Using {provider} / {model}[/]\n")
    return provider, model


# ════════════════════════════════════════════════════════════
#  Dashboard
# ════════════════════════════════════════════════════════════
def _show_dashboard(model_label: str) -> None:
    t = Table(title="Session Summary", expand=True, show_lines=True)
    t.add_column("Metric", style="bold")
    t.add_column("Value", justify="right")
    t.add_row("AI Model", model_label)
    t.add_row("Log lines processed", str(_stats["lines"]))
    t.add_row("Errors detected", f"[red]{_stats['errors']}[/]")
    t.add_row("Warnings detected", f"[yellow]{_stats['warnings']}[/]")
    t.add_row("Fixes applied", f"[green]{_stats['fixes_applied']}[/]")
    console.print(t)


# ════════════════════════════════════════════════════════════
#  Log line display
# ════════════════════════════════════════════════════════════
def _print_log_line(entry) -> None:
    color = SERVICE_COLORS.get(entry.service, "white")
    tag = f"[bold {color}][{entry.service:>8}][/]"
    if entry.level == "error":
        console.print(f"{tag} [red]{entry.line}[/]")
    elif entry.level == "warning":
        console.print(f"{tag} [yellow]{entry.line}[/]")
    else:
        console.print(f"{tag} [dim]{entry.line}[/]")


# ════════════════════════════════════════════════════════════
#  De-duplication
# ════════════════════════════════════════════════════════════
def _is_dup(err: ErrorEvent) -> bool:
    key = f"{err.service}:{err.subcategory}:{err.message[:100]}"
    now = time.time()
    if key in _seen and (now - _seen[key]) < DEDUP_WINDOW_SECS:
        return True
    _seen[key] = now
    return False


# ════════════════════════════════════════════════════════════
#  Error handling flow
# ════════════════════════════════════════════════════════════
def _handle_error(
    error: ErrorEvent,
    handler: ErrorHandler,
    auto_fix: bool,
) -> None:
    if _is_dup(error):
        return

    # stats
    if error.level in ("error", "critical"):
        _stats["errors"] += 1
    else:
        _stats["warnings"] += 1

    svc_c = SERVICE_COLORS.get(error.service, "white")
    lvl_c = {"error": "red", "critical": "bold red", "warning": "yellow"}.get(
        error.level, "red"
    )

    src = ""
    if error.source_file:
        src = f"\n[dim]Source: {error.source_file}"
        if error.source_line:
            src += f":{error.source_line}"
        src += "[/]"

    emoji = "🔧" if error.category == "simple" else "🏗️ "
    console.print()
    console.print(
        Panel(
            f"[bold {lvl_c}]{error.level.upper()}[/] in "
            f"[{svc_c}]{error.service}[/]\n\n"
            f"[{lvl_c}]{error.message}[/]\n\n"
            f"[dim]Type: {error.subcategory}  •  "
            f"Complexity: {error.category.upper()}[/]{src}",
            title=f"{emoji} Error Detected",
            border_style=lvl_c,
        )
    )

    # skip noisy deprecation warnings
    if error.subcategory == "deprecation" and error.level == "warning":
        console.print("[dim]  ↳ deprecation warning noted[/]")
        return

    # ── auto-fix path ──
    if auto_fix and error.category == "simple":
        with console.status("[bold cyan]Auto-analysing …[/]"):
            result = handler.handle_simple(error)
        if result["type"] == "command" and result.get("auto_applicable"):
            console.print(f"[green]  Auto-fix → {result['description']}[/]")
            console.print(f"[dim]  $ {result['command']}[/]")
            ok, out = handler.apply_command_fix(result["command"])
            if ok:
                console.print("[bold green]  ✓ applied![/]")
                _stats["fixes_applied"] += 1
            else:
                console.print(f"[red]  ✗ failed: {out[:300]}[/]")
            return

    # ── interactive path ──
    console.print("\n[bold]What would you like to do?[/]")
    console.print("  [cyan]1.[/] 🤖  Analyse & suggest fix with AI")
    console.print("  [yellow]2.[/] 📋  Show full log context first")
    console.print("  [dim]3.[/] ⏭️   Skip")
    console.print()
    action = Prompt.ask("Choice", choices=["1", "2", "3"], default="1")

    if action == "3":
        return

    if action == "2":
        console.print(
            Panel(
                "\n".join(error.context_lines),
                title="Log Context",
                border_style="dim",
            )
        )
        if not Confirm.ask("\nAnalyse with AI?", default=True):
            return

    # ── call AI ──
    with console.status("[bold cyan]Querying AI …[/]"):
        if error.category == "simple":
            result = handler.handle_simple(error)
        else:
            result = handler.handle_complex(error)

    _display_result(result, error, handler)


def _display_result(result: dict, error: ErrorEvent, handler: ErrorHandler):
    rtype = result["type"]

    # ── quick command fix ──
    if rtype == "command":
        console.print(
            Panel(
                f"[bold]{result['description']}[/]\n\n"
                f"  [green]$ {result['command']}[/]",
                title="🔧 Quick Fix",
                border_style="green",
            )
        )
        if Confirm.ask("Apply this fix?", default=True):
            with console.status("Applying …"):
                ok, out = handler.apply_command_fix(result["command"])
            if ok:
                console.print("[bold green]✓ Fix applied![/]")
                _stats["fixes_applied"] += 1
            else:
                console.print(f"[red]✗ Failed:[/] {out[:400]}")
        return

    # ── AI suggestion (simple) ──
    if rtype == "ai_suggestion":
        console.print(
            Panel(
                Markdown(result["suggestion"]),
                title="🔧 AI Suggestion",
                border_style="cyan",
            )
        )
        return

    # ── proposals (complex) ──
    if rtype == "proposals":
        console.print(
            Panel(
                Markdown(result["proposals"]),
                title="🏗️  Proposed Approaches",
                border_style="yellow",
            )
        )
        console.print("\n[bold]Pick an approach for a detailed plan:[/]")
        console.print("  [cyan]1 / 2 / 3[/]  – select approach")
        console.print("  [dim]s[/]          – skip")

        pick = Prompt.ask("Choice", default="s")
        if pick not in ("1", "2", "3"):
            return

        extra = Prompt.ask(
            "[dim]Any additional suggestions / constraints? "
            "(Enter to skip)[/]",
            default="",
        )

        follow = f"The user chose **approach #{pick}**."
        if extra:
            follow += f"\nUser's additional input: {extra}"
        follow += (
            "\n\nProvide a detailed step-by-step implementation plan with "
            "exact file paths, shell commands, and code diffs."
        )

        with console.status("[bold cyan]Generating detailed plan …[/]"):
            detail = handler.ai.query(
                f"Original error in {error.service}:\n"
                f"```\n{error.message}\n```\n\n"
                f"Proposed approaches:\n{result['proposals']}\n\n{follow}",
                SYSTEM_PROMPT,
            )

        console.print(
            Panel(
                Markdown(detail),
                title=f"📋  Implementation Plan  (Approach #{pick})",
                border_style="green",
            )
        )


# ════════════════════════════════════════════════════════════
#  Main loop
# ════════════════════════════════════════════════════════════
def main() -> None:
    args = _parse_args()

    # model
    if args.provider and args.model:
        provider, model = args.provider, args.model
        console.print(f"[bold green]✓  Using {provider} / {model}[/]\n")
    else:
        provider, model = _select_model()

    ai = AIClient(provider, model)
    handler = ErrorHandler(ai)
    watcher = LogWatcher(LOG_FILES)
    label = f"{provider}/{model}"

    existing = [s for s, p in LOG_FILES.items() if os.path.exists(p)]
    if existing:
        console.print(f"[green]Monitoring:[/] {', '.join(existing)}")
    else:
        console.print(
            "[yellow]⚠  No log files yet – waiting for services …[/]"
        )

    console.print("[dim]Press Ctrl-C to stop.\n[/]")
    console.print("─" * 60)

    try:
        while True:
            new_lines, new_errors = watcher.scan()

            for entry in new_lines:
                _stats["lines"] += 1
                _print_log_line(entry)

            for err in new_errors:
                _handle_error(err, handler, args.auto_fix)
                console.print("─" * 60)

            time.sleep(SCAN_INTERVAL)

    except KeyboardInterrupt:
        console.print("\n")
        _show_dashboard(label)
        console.print("\n[bold]Monitor stopped.[/]")


if __name__ == "__main__":
    main()
