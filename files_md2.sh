#!/bin/bash
# =============================================================================
# files_md2.sh  —  Manifest + Dependency Edge Graph
#
# Generates token-efficient codebase context for LLM-assisted code modification.
# The LLM uses this in two passes:
#   Pass 1 — reads Manifest to identify semantically relevant files
#   Pass 2 — traces Dependency Graph to determine blast radius
#
# Output: graph.txt  (~1-3K tokens vs 100K+ for full code dump)
#
# Inclusion/exclusion rules are identical to files_md.sh.
# =============================================================================

OUTPUT_FILE="graph.txt"
START_DIR="."
MAX_DEPTH=6

# ─── Exclusions (mirror of files_md.sh) ──────────────────────────────────────
declare -a IGNORE_DIRS=(
  # Package / build artefacts
  "node_modules" "dist" "build" ".venv" "venv" "__pycache__" ".git" ".vscode"
  # Assets & uploads
  "assets" "backup_assets" "public" "uploads"
  # Documentation
  "docs" "walkthrough" "generated_docs"
  # Testing
  "tests" "test-results"
  # Data / course content
  "course_bootstrap" "Cpurses"
  # Infrastructure / monitoring
  "grafana" "prometheus" "nginx" "monitor"
  # Misc non-core
  "logs"
)

# Only actual code files (same as files_md.sh)
declare -a INCLUDE_EXTENSIONS=("js" "jsx" "py")

# File-name patterns to skip even if extension matches
declare -a EXCLUDE_PATTERNS=(
  "*.test.*" "*.spec.*" "test_*"
  "*.config.*"
  "playwright.*" "instrument.*"
  "*.min.*"
  "eslint.*" "postcss.*" "tailwind.*" "vite.*"
  "lint-*"
  "package.json" "package-lock.json"
  "graph.txt"
)

# ─── Priority order (mirror of files_md.sh) ──────────────────────────────────
declare -a PRIORITY_PATHS=(
  "server/server.js"
  "server/config"
  "server/models"
  "server/middleware"
  "server/controllers"
  "server/routes"
  "server/workers"
  "server/jobs"
  "server/utils"
  "server/socratic_service"
  "server/rag_service"
  "server/services"
  "frontend/src/App.jsx"
  "frontend/src/main.jsx"
  "frontend/src/services"
  "frontend/src/pages"
  "frontend/src/hooks"
  "frontend/src/utils"
  "frontend/src/components/core"
  "frontend/src/components/layout"
  "frontend/src/components/auth"
  "frontend/src/components/chat"
  "frontend/src/components/tutor"
  "frontend/src/components/admin"
  "frontend/src/components/tools"
  "frontend/src/components"
  "frontend/src"
  "frontend"
  "server"
  "."
)

# =============================================================================
# Utility functions
# =============================================================================

# Normalize a path: collapse a/b/../c → a/c, strip leading ./
normalize_path() {
  local p="${1#./}"
  # Resolve .. segments (up to 10 levels)
  local i
  for ((i=0; i<10; i++)); do
    local new
    new=$(echo "$p" | sed 's|[^/][^/]*/\.\./||')
    [[ "$new" == "$p" ]] && break
    p="$new"
  done
  echo "${p#./}"
}

# Extract a one-line description from a file.
# Strategy: first meaningful comment/docstring → fallback to path inference.
extract_desc() {
  local file="$1"
  local ext="${file##*.}"
  local desc=""

  case "$ext" in
    py)
      # Module docstring: first non-empty line inside """ or '''
      desc=$(awk '
        /^"""/ || /^'"'"''"'"''"'"'/ {
          found=1; sub(/^"""|^'"'"''"'"''"'"'/, "")
          gsub(/"""$|'"'"''"'"''"'"'$/, "")
          if (length($0) > 3) { print substr($0,1,80); exit }
          next
        }
        found && /"""/ || found && /'"'"''"'"''"'"'/ { exit }
        found && /[a-zA-Z]/ { print substr($0,1,80); exit }
        !found && /^#[^!]/ { sub(/^#+[ \t]*/,""); if(length>3){ print substr($0,1,80); exit } }
        !found && NF && !/^#/ { exit }
      ' "$file" 2>/dev/null | head -1)
      ;;
    js|jsx)
      # First // comment block at top of file (before any non-comment code)
      desc=$(awk '
        /^[ \t]*\/\// {
          sub(/^[ \t]*\/\/+[ \t]*/, "")
          if (length($0) > 3) { print substr($0,1,80); exit }
          next
        }
        /^[ \t]*\/\*/ {
          sub(/^[ \t]*\/\*+[ \t]*/, ""); sub(/\*\/$/, ""); gsub(/^[ \t*]+/, "")
          if (length($0) > 3) { print substr($0,1,80); exit }
          next
        }
        NF && !/^[ \t]*(\/\/|\/\*|\*)/ { exit }
      ' "$file" 2>/dev/null | head -1)
      ;;
  esac

  # Strip non-ASCII bytes (box-drawing chars, Unicode decorators, etc.)
  # so they don't corrupt the plain-text output columns.
  desc=$(echo "$desc" | LC_ALL=C tr -cd '[:print:]' | xargs)
  # If stripping left nothing meaningful, let the fallback handle it
  [ "${#desc}" -lt 3 ] && desc=""

  # Universal fallback: build description from directory + camelCase filename
  if [ -z "$desc" ]; then
    local base dir words
    base=$(basename "$file" | sed 's/\.[^.]*$//')
    # camelCase and kebab/snake → space-separated words
    words=$(echo "$base" \
      | sed 's/\([a-z0-9]\)\([A-Z]\)/\1 \2/g' \
      | sed 's/[-_]/ /g' \
      | tr '[:upper:]' '[:lower:]' \
      | xargs)
    dir=$(dirname "$file" | rev | cut -d'/' -f1 | rev)
    # Skip uninformative dir names
    case "$dir" in
      .|src|lib|frontend|server) dir="" ;;
    esac
    [ -n "$dir" ] && desc="${dir}: ${words}" || desc="$words"
  fi

  echo "$desc" | tr '|' '-' | xargs
}

# Extract key exports from a JS/JSX file (max 6)
extract_js_exports() {
  local file="$1"
  {
    # export default function/class Name
    grep -oE 'export default (async function|function|class) [A-Za-z_][A-Za-z0-9_]*' "$file" 2>/dev/null \
      | sed 's/export default async function //; s/export default function //; s/export default class //'
    # export const/function/class/let/var Name
    grep -oE 'export (const|function|async function|class|let|var) [A-Za-z_][A-Za-z0-9_]*' "$file" 2>/dev/null \
      | sed 's/export const //; s/export async function //; s/export function //; s/export class //; s/export let //; s/export var //'
    # module.exports.Name = or exports.Name =
    grep -oE '(module\.exports|exports)\.[A-Za-z_][A-Za-z0-9_]* *=' "$file" 2>/dev/null \
      | grep -oE '\.[A-Za-z_][A-Za-z0-9_]*' | tr -d '.'
    # router.METHOD('/path') — show as METHOD:/path
    grep -oE "router\.(get|post|put|delete|patch)\(['\"][^'\"]*['\"]" "$file" 2>/dev/null \
      | sed "s/router\.\([a-z]*\)(['\]\([^'\"]*\)['\]/\U\1\E:\2/"
  } | grep -v '^$' | sort -u | head -6 | paste -sd ',' - | tr -d '\n'
}

# Extract top-level public defs from a Python file (max 6)
extract_py_exports() {
  local file="$1"
  grep -E '^(async def |def |class )[^_]' "$file" 2>/dev/null \
    | sed 's/async def \([A-Za-z_][A-Za-z0-9_]*\).*/\1/;
           s/def \([A-Za-z_][A-Za-z0-9_]*\).*/\1/;
           s/class \([A-Za-z_][A-Za-z0-9_]*\).*/\1/' \
    | grep -v '^__' \
    | sort -u | head -6 | paste -sd ',' - | tr -d '\n'
}

# Resolve a relative JS/JSX import specifier to a file in our index.
# Args: $1=importer path, $2=import specifier (e.g. './foo', '../bar')
# Prints resolved path, or nothing if not in index.
resolve_js() {
  local importer="$1" spec="$2"
  [[ "$spec" != ./* && "$spec" != ../* ]] && return

  local base
  base=$(dirname "$importer")
  local raw
  raw=$(normalize_path "${base}/${spec}")

  local try
  for try in "$raw" "${raw}.js" "${raw}.jsx" "${raw}/index.js" "${raw}/index.jsx"; do
    if [[ -n "${FILE_INDEX[$try]+_}" ]]; then
      echo "$try"
      return
    fi
  done
}

# Resolve a Python import specifier to a file in our index.
# Args: $1=importer path, $2=module spec (e.g. '.foo', 'server.services.bar')
resolve_py() {
  local importer="$1" spec="$2"

  local dots="${spec%%[!.]*}"
  local mod="${spec:${#dots}}"
  local mod_path="${mod//.//}"
  local rel_path

  if [[ -n "$dots" ]]; then
    # Relative import: ascend N-1 levels from importer's package
    local pkg_dir
    pkg_dir=$(dirname "$importer")
    local i
    for ((i=1; i<${#dots}; i++)); do
      pkg_dir=$(dirname "$pkg_dir")
    done
    rel_path=$(normalize_path "${pkg_dir}/${mod_path}")
  else
    # Absolute import within project (e.g. server.services.foo)
    rel_path=$(normalize_path "$mod_path")
  fi

  local try
  for try in "${rel_path}.py" "${rel_path}/__init__.py"; do
    if [[ -n "${FILE_INDEX[$try]+_}" ]]; then
      echo "$try"
      return
    fi
  done
}

# =============================================================================
# File collection
# =============================================================================

# Build find ignore opts
ignore_opts=("(")
first=true
for dir in "${IGNORE_DIRS[@]}"; do
  [ "$first" = false ] && ignore_opts+=("-o")
  ignore_opts+=("-name" "$dir" "-type" "d")
  first=false
done
ignore_opts+=(")" "-prune")

# Build find include opts
include_opts=("(")
first=true
for ext in "${INCLUDE_EXTENSIONS[@]}"; do
  [ "$first" = false ] && include_opts+=("-o")
  include_opts+=("-name" "*.$ext")
  first=false
done
include_opts+=(")")

# Build exclude opts
exclude_opts=()
for pat in "${EXCLUDE_PATTERNS[@]}"; do
  exclude_opts+=(! -name "$pat")
done

OUTPUT_BASENAME=$(basename "$OUTPUT_FILE")

echo "Scanning '${START_DIR}' (max depth ${MAX_DEPTH})..."

mapfile -t ALL_FILES < <(
  find "$START_DIR" -maxdepth "$MAX_DEPTH" \
    "${ignore_opts[@]}" \
    -o \
    \( -type f "${include_opts[@]}" "${exclude_opts[@]}" ! -name "$OUTPUT_BASENAME" \) \
    -print \
  | sort | sed 's|^\./||'
)

echo "Candidate files: ${#ALL_FILES[@]}"

# Build fast lookup index
declare -A FILE_INDEX
for f in "${ALL_FILES[@]}"; do
  FILE_INDEX["$f"]=1
done

# Sort files by priority (same logic as files_md.sh)
declare -A FILE_PRIORITY
for file in "${ALL_FILES[@]}"; do
  best=9999
  idx=0
  for pp in "${PRIORITY_PATHS[@]}"; do
    if [[ "$file" == "$pp" || "$file" == "$pp"/* ]]; then
      (( idx < best )) && best=$idx
    fi
    (( idx++ ))
  done
  FILE_PRIORITY["$file"]=$best
done

mapfile -t SORTED_FILES < <(
  for f in "${ALL_FILES[@]}"; do
    printf '%d %s\n' "${FILE_PRIORITY[$f]}" "$f"
  done | sort -n -s -k1,1 | cut -d' ' -f2-
)

# =============================================================================
# Build dependency edges
# =============================================================================

echo "Extracting dependencies..."

declare -a EDGES=()

for file in "${SORTED_FILES[@]}"; do
  ext="${file##*.}"
  case "$ext" in
    js|jsx)
      while IFS= read -r spec; do
        [[ -z "$spec" ]] && continue
        resolved=$(resolve_js "$file" "$spec")
        [[ -n "$resolved" && "$resolved" != "$file" ]] && EDGES+=("${file}|${resolved}")
      done < <(
        grep -oE "(from|require\()\s*['\"][^'\"]+['\"]" "$file" 2>/dev/null \
          | grep -oE "['\"][^'\"]+['\"]" \
          | tr -d "'\"" \
          | grep -E "^\.\.?/"
      )
      ;;
    py)
      while IFS= read -r spec; do
        [[ -z "$spec" ]] && continue
        resolved=$(resolve_py "$file" "$spec")
        [[ -n "$resolved" && "$resolved" != "$file" ]] && EDGES+=("${file}|${resolved}")
      done < <(
        grep -E "^(from|import) " "$file" 2>/dev/null | sed -n \
          's/^from \(\.[^ ]*\) import.*/\1/p;
           s/^from \(server\.[^ ]*\) import.*/\1/p;
           s/^from \(frontend\.[^ ]*\) import.*/\1/p;
           s/^import \(\.[^ ,]*\).*/\1/p'
      )
      ;;
  esac
done

# Deduplicate
mapfile -t EDGES < <(printf '%s\n' "${EDGES[@]}" | sort -u | grep -v '^$')

echo "Edges found: ${#EDGES[@]}"

# =============================================================================
# Write output
# =============================================================================

TEMP_OUTPUT=$(mktemp)
trap 'rm -f "$TEMP_OUTPUT"' EXIT

{

# ── Header ────────────────────────────────────────────────────────────────────
printf 'CODEBASE MANIFEST + DEPENDENCY GRAPH\n'
printf 'Auto-generated by files_md2.sh - token-efficient LLM context\n'
printf 'Files indexed: %d  |  Dependency edges: %d\n' "${#SORTED_FILES[@]}" "${#EDGES[@]}"
printf '%s\n\n' "$(printf '=%.0s' {1..60})"

# ── Section 1: Manifest ───────────────────────────────────────────────────────
printf 'MANIFEST\n'
printf 'One row per file. Use to identify relevant files for a modification request.\n'
printf '%s\n' "$(printf -- '-%.0s' {1..60})"
printf '%-55s  %-35s  %s\n' "FILE" "PURPOSE" "KEY EXPORTS / ROUTES"
printf '%-55s  %-35s  %s\n' "$(printf -- '-%.0s' {1..55})" "$(printf -- '-%.0s' {1..35})" "$(printf -- '-%.0s' {1..30})"

for file in "${SORTED_FILES[@]}"; do
  desc=$(extract_desc "$file")
  ext="${file##*.}"
  case "$ext" in
    js|jsx) exports=$(extract_js_exports "$file") ;;
    py)     exports=$(extract_py_exports "$file") ;;
    *)      exports="" ;;
  esac
  exports=$(echo "$exports" | cut -c1-50)
  printf '%-55s  %-35s  %s\n' "$file" "$(echo "$desc" | cut -c1-35)" "$exports"
done

printf '\n%s\n\n' "$(printf '=%.0s' {1..60})"

# ── Section 2: Dependency Edge List ──────────────────────────────────────────
printf 'DEPENDENCY EDGES\n'
printf 'Import/require relationships for blast-radius tracing.\n'
printf '%s\n' "$(printf -- '-%.0s' {1..60})"
for edge in "${EDGES[@]}"; do
  printf '%s -> %s\n' "${edge%%|*}" "${edge##*|}"
done

printf '\n%s\n\n' "$(printf '=%.0s' {1..60})"

# ── Section 3: File Index ─────────────────────────────────────────────────────
printf 'FILE INDEX (%d files)\n' "${#SORTED_FILES[@]}"
printf '%s\n' "$(printf -- '-%.0s' {1..60})"
for file in "${SORTED_FILES[@]}"; do
  printf '%s\n' "$file"
done

} > "$TEMP_OUTPUT"

mv "$TEMP_OUTPUT" "$OUTPUT_FILE"
trap - EXIT

FINAL_BYTES=$(wc -c < "$OUTPUT_FILE")
FINAL_KB=$((FINAL_BYTES / 1024))
EST_TOKENS=$((FINAL_BYTES / 4))

printf '\n============================================\n'
printf ' Output  : %s\n'       "$OUTPUT_FILE"
printf ' Files   : %d\n'       "${#SORTED_FILES[@]}"
printf ' Edges   : %d\n'       "${#EDGES[@]}"
printf ' Size    : %d KB (~%d tokens)\n' "$FINAL_KB" "$EST_TOKENS"
printf '============================================\n'

exit 0
