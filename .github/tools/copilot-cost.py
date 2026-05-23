#!/usr/bin/env python3
"""copilot-cost — Calculate the USD cost of a GitHub Copilot chat session.

Reads token usage from the local agent-traces.db maintained by the
GitHub Copilot Chat VS Code extension and applies pricing rates from
copilot-models.json.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Compatibility ─────────────────────────────────────────────────────────────

# Tested against these versions. Update when verified with newer releases.
TESTED_VSCODE_VERSION = "1.120.0"
TESTED_COPILOT_CHAT_VERSION = "0.48.1"
REQUIRED_DB_COLUMNS = {
    "spans": {
        "span_id", "response_model", "input_tokens", "output_tokens",
        "cached_tokens", "start_time_ms", "operation_name", "chat_session_id",
    },
}

# ── VS Code storage path detection ───────────────────────────────────────────

def _find_vscode_user_dir() -> Path | None:
    """Detect the VS Code User directory across desktop, devcontainer, and Codespace."""
    db_rel = Path("globalStorage") / "github.copilot-chat" / "agent-traces.db"

    # 1. Detect from PATH — VS Code adds copilot-chat entries to PATH in all
    #    remote environments (devcontainers, Codespaces) regardless of the
    #    underlying directory layout.
    for entry in os.environ.get("PATH", "").split(os.pathsep):
        marker = os.sep + "globalStorage" + os.sep + "github.copilot-chat" + os.sep
        if marker in entry:
            user_dir = Path(entry[: entry.index(marker)])
            if (user_dir / db_rel).exists():
                return user_dir

    # 2. Derive from VSCODE_TARGET_SESSION_LOG (workspaceStorage is a sibling
    #    of globalStorage under the User directory).
    session_log = os.environ.get("VSCODE_TARGET_SESSION_LOG", "")
    if session_log:
        parts = Path(session_log).parts
        if "workspaceStorage" in parts:
            idx = parts.index("workspaceStorage")
            user_dir = Path(*parts[:idx])
            if (user_dir / db_rel).exists():
                return user_dir

    # 3. Platform-specific heuristic candidates (fallback).
    candidates: list[Path] = []

    if sys.platform == "darwin":
        candidates.append(Path.home() / "Library" / "Application Support" / "Code" / "User")
    elif sys.platform == "linux":
        candidates.extend([
            Path.home() / ".vscode-server" / "data" / "User",
            Path.home() / ".vscode-remote" / "data" / "User",
            Path.home() / ".config" / "Code" / "User",
        ])
    else:
        candidates.append(Path(os.environ.get("APPDATA", "")) / "Code" / "User")

    for path in candidates:
        if (path / db_rel).exists():
            return path
    return None


_VSCODE_USER = _find_vscode_user_dir()
COPILOT_STORAGE = _VSCODE_USER / "globalStorage" / "github.copilot-chat" if _VSCODE_USER else None
TRACES_DB: Path | None = COPILOT_STORAGE / "agent-traces.db" if COPILOT_STORAGE else None
WS_STORAGE: Path | None = _VSCODE_USER / "workspaceStorage" if _VSCODE_USER else None


# ── DB helpers ───────────────────────────────────────────────────────────────

def _connect(db_path: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)


def _check_compatibility(db_path: Path) -> None:
    """Warn if the DB schema doesn't match expectations or versions differ."""
    conn = _connect(db_path)
    try:
        cursor = conn.execute("PRAGMA table_info(spans)")
        actual_cols = {row[1] for row in cursor.fetchall()}
        missing = REQUIRED_DB_COLUMNS["spans"] - actual_cols
        if missing:
            print(
                f"Warning: agent-traces.db is missing expected columns: {missing}\n"
                f"This tool was tested with VS Code {TESTED_VSCODE_VERSION} and "
                f"Copilot Chat {TESTED_COPILOT_CHAT_VERSION}.\n"
                f"Your version may be older. Results may be incomplete.",
                file=sys.stderr,
            )
            return

        known_cols = {
            "span_id", "trace_id", "parent_span_id", "name", "start_time_ms",
            "end_time_ms", "status_code", "status_message", "operation_name",
            "provider_name", "agent_name", "conversation_id", "request_model",
            "response_model", "input_tokens", "output_tokens", "cached_tokens",
            "reasoning_tokens", "tool_name", "tool_call_id", "tool_type",
            "chat_session_id", "turn_index", "ttft_ms",
        }
        new_cols = actual_cols - known_cols
        if new_cols:
            print(
                f"Note: DB has columns not seen during testing: {new_cols}\n"
                f"Your Copilot Chat extension may be newer than "
                f"{TESTED_COPILOT_CHAT_VERSION}.\n"
                f"The tool should still work but may miss new token categories.",
                file=sys.stderr,
            )
    finally:
        conn.close()


# ── Pricing ──────────────────────────────────────────────────────────────────

def find_pricing_file() -> Path | None:
    for anchor in [Path.cwd(), Path(__file__).resolve().parent]:
        for parent in [anchor, *anchor.parents]:
            candidate = parent / ".github" / "pricing" / "copilot-models.json"
            if candidate.exists():
                return candidate
    return None


def load_pricing(path: Path) -> dict[str, dict]:
    with open(path) as f:
        data = json.load(f)
    pricing: dict[str, dict] = {}
    for plan in data["plans"]:
        for m in plan["models"]:
            pricing[m["model"].lower()] = m
    return pricing


# ── Model-name mapping ──────────────────────────────────────────────────────

def build_name_map(ws_storage: Path | None = None) -> dict[str, str]:
    """Map DB response_model slugs to display names using models.json."""
    mapping: dict[str, str] = {}
    ws_storage = ws_storage or WS_STORAGE
    if not ws_storage or not ws_storage.exists():
        return mapping
    for ws_dir in sorted(ws_storage.iterdir(), reverse=True):
        debug_logs = ws_dir / "GitHub.copilot-chat" / "debug-logs"
        if not debug_logs.exists():
            continue
        for session_dir in sorted(debug_logs.iterdir(), reverse=True):
            models_file = session_dir / "models.json"
            if not models_file.exists():
                continue
            try:
                with open(models_file) as f:
                    models = json.load(f)
                for m in models:
                    mid = m["id"]
                    name = m["name"]
                    mapping[mid] = name
                    mapping[mid.replace(".", "-")] = name
                return mapping
            except (json.JSONDecodeError, KeyError):
                continue
    return mapping


def resolve_display_name(slug: str, name_map: dict[str, str]) -> str:
    return name_map.get(slug, slug)


def match_pricing(display_name: str, pricing: dict[str, dict]) -> dict | None:
    key = display_name.lower()
    if key in pricing:
        return pricing[key]
    clean = key.split("(")[0].strip()
    return pricing.get(clean)


# ── Session resolution ───────────────────────────────────────────────────────

def resolve_session_id(explicit: str | None, db_path: Path) -> str | None:
    if explicit:
        return explicit
    log_path = os.environ.get("VSCODE_TARGET_SESSION_LOG", "")
    if log_path:
        return Path(log_path).name
    conn = _connect(db_path)
    row = conn.execute(
        """SELECT chat_session_id FROM spans
           WHERE operation_name = 'chat'
             AND input_tokens IS NOT NULL
             AND chat_session_id IS NOT NULL
           ORDER BY start_time_ms DESC LIMIT 1"""
    ).fetchone()
    conn.close()
    return row[0] if row else None


def get_today_sessions(db_path: Path) -> list[str]:
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    ts_ms = int(today_start.timestamp() * 1000)
    conn = _connect(db_path)
    rows = conn.execute(
        """SELECT chat_session_id, MIN(start_time_ms) AS first_span
           FROM spans
           WHERE start_time_ms >= ?
             AND operation_name = 'chat'
             AND input_tokens IS NOT NULL
             AND chat_session_id IS NOT NULL
           GROUP BY chat_session_id
           ORDER BY first_span""",
        (ts_ms,),
    ).fetchall()
    conn.close()
    return [r[0] for r in rows]


# ── Token queries ────────────────────────────────────────────────────────────

def query_spans(db_path: Path, session_id: str) -> list[dict]:
    conn = _connect(db_path)
    rows = conn.execute(
        """SELECT
               s.response_model,
               s.input_tokens,
               s.output_tokens,
               s.cached_tokens,
               s.start_time_ms,
               CAST(COALESCE(
                   (SELECT sa.value FROM span_attributes sa
                    WHERE sa.span_id = s.span_id
                      AND sa.key = 'gen_ai.usage.cache_creation.input_tokens'),
                   '0'
               ) AS INTEGER) AS cache_write_tokens
           FROM spans s
           WHERE s.chat_session_id = ?
             AND s.operation_name = 'chat'
             AND s.input_tokens IS NOT NULL
           ORDER BY s.start_time_ms""",
        (session_id,),
    ).fetchall()
    conn.close()
    cols = [
        "response_model", "input_tokens", "output_tokens",
        "cached_tokens", "start_time_ms", "cache_write_tokens",
    ]
    return [dict(zip(cols, r)) for r in rows]


# ── Cost calculation ─────────────────────────────────────────────────────────

def calculate_costs(
    spans: list[dict],
    name_map: dict[str, str],
    pricing: dict[str, dict],
) -> list[dict]:
    results = []
    for span in spans:
        model_slug = span["response_model"] or "unknown"
        display_name = resolve_display_name(model_slug, name_map)
        price = match_pricing(display_name, pricing)

        input_tok = span["input_tokens"] or 0
        output_tok = span["output_tokens"] or 0
        cached_tok = span["cached_tokens"] or 0
        cw_tok = span["cache_write_tokens"] or 0

        if price:
            uncached = max(0, input_tok - cached_tok - cw_tok)
            p_cw = price.get("cache_write") or price["input"]
            cost = (
                uncached * price["input"]
                + cached_tok * price["cached_input"]
                + cw_tok * p_cw
                + output_tok * price["output"]
            ) / 1_000_000
        else:
            cost = None

        results.append({
            "model": display_name,
            "input_tokens": input_tok,
            "output_tokens": output_tok,
            "cached_tokens": cached_tok,
            "cache_write_tokens": cw_tok,
            "cost": cost,
            "start_time_ms": span["start_time_ms"],
        })
    return results


# ── Formatting helpers ───────────────────────────────────────────────────────

def _fc(cost: float | None) -> str:
    if cost is None:
        return "N/A"
    return f"${cost:.4f}" if cost < 0.01 else f"${cost:.2f}"


def _ft(n: int) -> str:
    return f"{n:,}"


def _time(ms: int) -> str:
    dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc).astimezone()
    return dt.strftime("%H:%M:%S")


# ── Output ───────────────────────────────────────────────────────────────────

def print_summary(costs: list[dict]) -> None:
    total = sum(c["cost"] for c in costs if c["cost"] is not None)
    models = sorted({c["model"] for c in costs})
    print(f"Session cost: {_fc(total)} ({', '.join(models)}, {len(costs)} turns)")


def print_verbose(costs: list[dict], session_id: str) -> None:
    models = sorted({c["model"] for c in costs})
    print(f"Session:  {session_id}")
    print(f"Model(s): {', '.join(models)}")
    print(f"Turns:    {len(costs)}")
    print()

    hdr = (
        f"{'#':>4}  {'Time':>8}  {'Input':>10}  {'Cached':>10}"
        f"  {'CacheWr':>10}  {'Output':>8}  {'Cost':>9}"
    )
    sep = (
        f"{'─'*4}  {'─'*8}  {'─'*10}  {'─'*10}"
        f"  {'─'*10}  {'─'*8}  {'─'*9}"
    )
    print(hdr)
    print(sep)

    t_cost, t_in, t_out, t_cached, t_cw = 0.0, 0, 0, 0, 0
    for i, c in enumerate(costs, 1):
        t_cost += c["cost"] or 0
        t_in += c["input_tokens"]
        t_out += c["output_tokens"]
        t_cached += c["cached_tokens"]
        t_cw += c["cache_write_tokens"]
        print(
            f"{i:>4}  {_time(c['start_time_ms']):>8}"
            f"  {_ft(c['input_tokens']):>10}  {_ft(c['cached_tokens']):>10}"
            f"  {_ft(c['cache_write_tokens']):>10}  {_ft(c['output_tokens']):>8}"
            f"  {_fc(c['cost']):>9}"
        )

    print(sep)
    print(
        f"{'Σ':>4}  {'':>8}"
        f"  {_ft(t_in):>10}  {_ft(t_cached):>10}"
        f"  {_ft(t_cw):>10}  {_ft(t_out):>8}"
        f"  {_fc(t_cost):>9}"
    )


def print_today_summary(all_costs: list[tuple[str, list[dict]]]) -> None:
    total = sum(
        c["cost"] for _, costs in all_costs for c in costs if c["cost"] is not None
    )
    turns = sum(len(costs) for _, costs in all_costs)
    print(f"Today's cost: {_fc(total)} ({len(all_costs)} sessions, {turns} turns)")


def print_today_verbose(all_costs: list[tuple[str, list[dict]]]) -> None:
    today = datetime.now().strftime("%Y-%m-%d")
    print(f"Sessions for {today}")
    print()
    hdr = f"{'Session':<38}  {'Model':<22}  {'Turns':>5}  {'Cost':>9}"
    sep = f"{'─'*38}  {'─'*22}  {'─'*5}  {'─'*9}"
    print(hdr)
    print(sep)

    grand = 0.0
    total_turns = 0
    for sid, costs in all_costs:
        session_cost = sum(c["cost"] for c in costs if c["cost"] is not None)
        grand += session_cost
        total_turns += len(costs)
        models = sorted({c["model"] for c in costs})
        print(
            f"{sid:<38}  {', '.join(models):<22}"
            f"  {len(costs):>5}  {_fc(session_cost):>9}"
        )

    print(sep)
    print(f"{'Total':<38}  {'':<22}  {total_turns:>5}  {_fc(grand):>9}")


# ── CLI ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Calculate the USD cost of a GitHub Copilot chat session.",
    )
    parser.add_argument(
        "session", nargs="?",
        help="Chat session ID (default: from VSCODE_TARGET_SESSION_LOG or latest)",
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true",
        help="Show per-turn cost breakdown",
    )
    parser.add_argument(
        "--last", action="store_true",
        help="Show only the cost of the last turn",
    )
    parser.add_argument(
        "--today", action="store_true",
        help="Show costs for all sessions today",
    )
    parser.add_argument(
        "--pricing", type=Path,
        help="Path to copilot-models.json (auto-detected by default)",
    )
    parser.add_argument(
        "--db", type=Path,
        help="Path to agent-traces.db (auto-detected by default)",
    )
    args = parser.parse_args()

    db_path = args.db or TRACES_DB
    if not db_path or not db_path.exists():
        # Detect browser-based Codespace (no desktop VS Code client)
        is_codespace = os.environ.get("CODESPACES") == "true"
        is_remote_containers = os.environ.get("REMOTE_CONTAINERS") == "true"
        has_copilot_in_path = any(
            "github.copilot-chat" in p
            for p in os.environ.get("PATH", "").split(os.pathsep)
        )
        if has_copilot_in_path and (is_codespace or is_remote_containers):
            sys.exit(
                "Error: agent-traces.db not found.\n"
                "The Copilot Chat extension is installed but the trace database\n"
                "does not exist. This happens in browser-based Codespaces where\n"
                "session traces are stored in browser storage, not on the\n"
                "container filesystem.\n"
                "Workaround: connect to the Codespace from VS Code Desktop\n"
                "instead of the browser, or run this script locally."
            )
        sys.exit(
            "Error: agent-traces.db not found.\n"
            f"This tool requires VS Code >= {TESTED_VSCODE_VERSION} with "
            f"Copilot Chat >= {TESTED_COPILOT_CHAT_VERSION}.\n"
            "Use --db to specify the path manually."
        )

    _check_compatibility(db_path)

    pricing_path = args.pricing or find_pricing_file()
    if not pricing_path:
        sys.exit(
            "Error: copilot-models.json not found. "
            "Use --pricing to specify its location."
        )

    pricing = load_pricing(pricing_path)
    name_map = build_name_map()

    if args.today:
        session_ids = get_today_sessions(db_path)
        if not session_ids:
            sys.exit("No sessions found for today.")
        all_costs = []
        for sid in session_ids:
            spans = query_spans(db_path, sid)
            if spans:
                all_costs.append((sid, calculate_costs(spans, name_map, pricing)))
        if not all_costs:
            sys.exit("No token data found for today's sessions.")
        if args.verbose:
            print_today_verbose(all_costs)
        else:
            print_today_summary(all_costs)
    else:
        session_id = resolve_session_id(args.session, db_path)
        if not session_id:
            sys.exit(
                "Error: no session ID found. "
                "Pass one explicitly or set VSCODE_TARGET_SESSION_LOG."
            )
        spans = query_spans(db_path, session_id)
        if not spans:
            sys.exit(f"Error: no token data for session {session_id}")
        costs = calculate_costs(spans, name_map, pricing)
        if args.last:
            c = costs[-1]
            print(f"Last turn: {_fc(c['cost'])} ({_ft(c['input_tokens'])} in, {_ft(c['output_tokens'])} out)")
        elif args.verbose:
            print_verbose(costs, session_id)
        else:
            print_summary(costs)


if __name__ == "__main__":
    main()
