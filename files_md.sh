#!/bin/bash

# ============================================================================
# Repository Architecture Dump — lean output targeting ≤ 400K tokens
#
# Only captures actual code (JS/JSX/PY) that defines architecture and logic.
# Excludes: CSS, HTML, Markdown, PDFs, test files, config boilerplate,
#           documentation, infrastructure configs, generated files, assets.
# Enforces a TOTAL SIZE CAP so the output stays manageable for LLMs.
# ============================================================================

# --- Configuration ---
START_DIR="."
MAX_DEPTH=6
OUTPUT_FILE="code.txt"
MAX_FILE_SIZE_KB=100          # Skip individual files larger than this
MAX_TOTAL_SOURCE_KB=1400      # ≈ 375 K tokens — stop adding files after this

# --- Directories to IGNORE (non-architecture content) ---
declare -a IGNORE_DIRS=(
  # Package / build artefacts
  "node_modules" "dist" "build" ".venv" "venv" "__pycache__" ".git" ".vscode"
  # Assets & uploads
  "assets" "backup_assets" "public" "uploads"
  # Documentation & walkthroughs
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

# --- Only include actual code files (architecture & logic) ---
declare -a INCLUDE_EXTENSIONS=("js" "jsx" "py")

# --- File-name patterns to SKIP even if extension matches ---
declare -a EXCLUDE_PATTERNS=(
  "*.test.*" "*.spec.*" "test_*"
  "*.config.*"
  "playwright.*" "instrument.*"
  "*.min.*"
  "eslint.*" "postcss.*" "tailwind.*" "vite.*"
  "lint-*"
  "package.json" "package-lock.json"
)

# --- Priority order for directories (most architectural first) ---
# Files in higher-priority paths are added first so we never run out
# of budget on less important leaf components.
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

# =========================================================================
# Script Logic
# =========================================================================

if [ ! -d "$START_DIR" ]; then
  echo "Error: Start directory '$START_DIR' not found." >&2
  exit 1
fi

TEMP_OUTPUT=$(mktemp)
trap 'rm -f "$TEMP_OUTPUT"' EXIT

# ---- Build find IGNORE opts ----
ignore_opts=()
if [ ${#IGNORE_DIRS[@]} -gt 0 ]; then
  ignore_opts+=("(")
  first=true
  for dir in "${IGNORE_DIRS[@]}"; do
    [ "$first" = false ] && ignore_opts+=("-o")
    ignore_opts+=("-name" "$dir" "-type" "d")
    first=false
  done
  ignore_opts+=(")" "-prune")
else
  ignore_opts+=("(" "-false" ")" "-prune")
fi

# ---- Build find INCLUDE opts (extensions) ----
include_opts=()
if [ ${#INCLUDE_EXTENSIONS[@]} -gt 0 ]; then
  include_opts+=("(")
  first=true
  for ext in "${INCLUDE_EXTENSIONS[@]}"; do
    [ "$first" = false ] && include_opts+=("-o")
    include_opts+=("-name" "*.$ext")
    first=false
  done
  include_opts+=(")")
fi

# ---- Build find EXCLUDE opts (filename patterns) ----
exclude_opts=()
for pat in "${EXCLUDE_PATTERNS[@]}"; do
  exclude_opts+=(! -name "$pat")
done

OUTPUT_BASENAME=$(basename "$OUTPUT_FILE")

echo "Scanning '$START_DIR' (max depth ${MAX_DEPTH}) for architecture files..."

# ---- Collect all candidate files ----
mapfile -t ALL_FILES < <(
  find "$START_DIR" -maxdepth "$MAX_DEPTH" \
    "${ignore_opts[@]}" \
    -o \
    \( -type f "${include_opts[@]}" "${exclude_opts[@]}" ! -name "$OUTPUT_BASENAME" \) \
    -print | sort
)

echo "Found ${#ALL_FILES[@]} candidate files."

# ---- Sort files by priority ----
# Assign a numeric priority to each file based on PRIORITY_PATHS order.
declare -A FILE_PRIORITY
for file in "${ALL_FILES[@]}"; do
  clean="${file#./}"
  best_pri=9999
  idx=0
  for pp in "${PRIORITY_PATHS[@]}"; do
    if [[ "$clean" == "$pp" || "$clean" == "$pp"/* ]]; then
      if [ $idx -lt $best_pri ]; then
        best_pri=$idx
      fi
    fi
    ((idx++))
  done
  FILE_PRIORITY["$file"]=$best_pri
done

# Sort ALL_FILES by priority (stable — preserves alphabetical within same priority)
mapfile -t SORTED_FILES < <(
  for file in "${ALL_FILES[@]}"; do
    echo "${FILE_PRIORITY[$file]} $file"
  done | sort -n -s -k1,1 | cut -d' ' -f2-
)

# ---- Select files up to the budget ----
declare -a SELECTED_FILES=()
declare -a SKIPPED_SIZE=()
declare -a SKIPPED_BUDGET=()
cumulative_kb=0

for file in "${SORTED_FILES[@]}"; do
  size_kb=$(du -k "$file" 2>/dev/null | cut -f1)
  size_kb=${size_kb:-0}

  # Skip individual files that are too large
  if [ "$size_kb" -gt "$MAX_FILE_SIZE_KB" ]; then
    SKIPPED_SIZE+=("$file")
    continue
  fi

  # Check total budget
  new_total=$((cumulative_kb + size_kb))
  if [ "$new_total" -gt "$MAX_TOTAL_SOURCE_KB" ]; then
    SKIPPED_BUDGET+=("$file")
    continue
  fi

  SELECTED_FILES+=("$file")
  cumulative_kb=$new_total
done

echo "Selected ${#SELECTED_FILES[@]} files (${cumulative_kb} KB)."
[ ${#SKIPPED_SIZE[@]} -gt 0 ]   && echo "Skipped ${#SKIPPED_SIZE[@]} files (over ${MAX_FILE_SIZE_KB}KB each)."
[ ${#SKIPPED_BUDGET[@]} -gt 0 ] && echo "Skipped ${#SKIPPED_BUDGET[@]} files (budget ${MAX_TOTAL_SOURCE_KB}KB reached)."

# ---- Write header + Table of Contents ----
{
  printf '# Repository Architecture & Logic Dump\n\n'
  printf '> Auto-generated — only core code files, ≤ %sKB total source\n\n' "$MAX_TOTAL_SOURCE_KB"
  printf '## Table of Contents (%d files)\n\n' "${#SELECTED_FILES[@]}"
  for file in "${SELECTED_FILES[@]}"; do
    clean="${file#./}"
    echo "- \`${clean}\`"
  done

  if [ ${#SKIPPED_SIZE[@]} -gt 0 ] || [ ${#SKIPPED_BUDGET[@]} -gt 0 ]; then
    printf '\n### Excluded files\n\n'
    for file in "${SKIPPED_SIZE[@]}"; do
      clean="${file#./}"
      size_kb=$(du -k "$file" 2>/dev/null | cut -f1)
      echo "- \`${clean}\` *(skipped: ${size_kb:-0}KB > ${MAX_FILE_SIZE_KB}KB limit)*"
    done
    for file in "${SKIPPED_BUDGET[@]}"; do
      clean="${file#./}"
      echo "- \`${clean}\` *(skipped: total budget exceeded)*"
    done
  fi

  printf '\n---\n\n'
} > "$TEMP_OUTPUT"

# ---- Write file contents ----
for file in "${SELECTED_FILES[@]}"; do
  clean="${file#./}"
  echo "  Adding: $clean"

  extension_lower=$(tr '[:upper:]' '[:lower:]' <<< "${clean##*.}")

  case "$extension_lower" in
    py)        lang="python" ;;
    js|jsx)    lang="javascript" ;;
    ts|tsx)    lang="typescript" ;;
    *)         lang="" ;;
  esac

  # Dynamic fence length to avoid breaking markdown
  max_ticks=$(grep -o '`\+' "$file" 2>/dev/null | awk '{ if (length($0) > m) m = length($0) } END { print m+0 }')
  fence_len=$(( max_ticks < 3 ? 3 : max_ticks + 1 ))
  fence=$(printf '%*s' "$fence_len" '' | tr ' ' '`')

  {
    printf '`%s`\n\n' "$clean"
    printf '%s%s\n' "$fence" "$lang"
    cat "$file"
    printf '\n%s\n\n' "$fence"
  } >> "$TEMP_OUTPUT"
done

# ---- Append compact directory tree (depth 3 only) ----
{
  printf '\n---\n\n## Directory Tree\n\n```\n'
  tree -a -L 3 --dirsfirst \
    -I 'node_modules|venv|.git|backup_assets|assets|dist|build|__pycache__|test-results|generated_docs|Cpurses|logs|uploads|course_bootstrap|walkthrough|public' \
    "$START_DIR" 2>/dev/null || find "$START_DIR" -maxdepth 3 -type d | sort
  printf '```\n'
} >> "$TEMP_OUTPUT"

# ---- Finalize ----
mv "$TEMP_OUTPUT" "$OUTPUT_FILE"
trap - EXIT

FINAL_BYTES=$(wc -c < "$OUTPUT_FILE")
FINAL_KB=$((FINAL_BYTES / 1024))
EST_TOKENS=$((FINAL_BYTES / 4))

echo ""
echo "============================================"
echo " Output: $OUTPUT_FILE"
echo " Size:   ${FINAL_KB} KB  (~${EST_TOKENS} tokens)"
echo "============================================"

exit 0
