#!/bin/bash

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

resolve_schema_file() {
    if [[ -f "$SCRIPT_DIR/int_database.sql" ]]; then
        echo "$SCRIPT_DIR/int_database.sql"
    elif [[ -f "$PROJECT_ROOT/int_database.sql" ]]; then
        echo "$PROJECT_ROOT/int_database.sql"
    else
        log_error "int_database.sql not found in $SCRIPT_DIR or $PROJECT_ROOT"
        exit 1
    fi
}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

require_psql() {
    if ! command -v psql >/dev/null 2>&1; then
        log_error "psql is not installed or not in PATH"
        exit 1
    fi
}

load_env() {
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        log_info "Loading environment from $PROJECT_ROOT/.env"
        set -a
        # shellcheck disable=SC1090
        source "$PROJECT_ROOT/.env"
        set +a
    else
        log_warn ".env not found, using current shell environment"
    fi

    : "${DATABASE_URL:?Error: DATABASE_URL not set (in .env or current shell environment)}"
}

execute_sql_file() {
    local sql_file="$1"
    local description="$2"

    if [[ ! -f "$sql_file" ]]; then
        log_error "SQL file not found: $sql_file"
        return 1
    fi

    log_info "$description"
    if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$sql_file"; then
        log_info "$description completed successfully"
    else
        log_error "$description failed"
        return 1
    fi
}

reset_database() {
    log_warn "Resetting database schema public (DROP SCHEMA public CASCADE)"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
    log_info "Database schema reset completed"
}

update_database() {
    local schema_file
    schema_file="$(resolve_schema_file)"

    execute_sql_file "$schema_file" "Applying schema from int_database.sql"
}

show_usage() {
    cat << EOF
Usage: $0 [OPTION]

Database schema management script for coach_sportif.

OPTIONS:
    update      Apply schema from int_database.sql (default)
    reset       Drop and recreate public schema, then apply int_database.sql
    help        Show this help message

ENVIRONMENT:
    Reads PROJECT_ROOT/.env if present.
    Requires DATABASE_URL.

EXAMPLES:
    $0
    $0 update
    $0 reset
EOF
}

main() {
    local action="${1:-update}"

    case "$action" in
        "help"|"-h"|"--help")
            show_usage
            exit 0
            ;;
    esac

    require_psql
    load_env

    case "$action" in
        "update"|"")
            update_database
            ;;
        "reset")
            reset_database
            update_database
            ;;
        *)
            log_error "Unknown action: $action"
            show_usage
            exit 1
            ;;
    esac

    log_info "Database management completed successfully"
}

main "$@"
