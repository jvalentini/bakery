#!/usr/bin/env bash
set -euo pipefail

REPO="jvalentini/bakery"
BINARY_NAME="bakery"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

CLEANUP_DIR=""

cleanup() {
    if [[ -n "${CLEANUP_DIR:-}" ]] && [[ -d "${CLEANUP_DIR:-}" ]]; then
        rm -rf "$CLEANUP_DIR"
    fi
}

trap cleanup EXIT

error() {
    echo -e "${RED}error:${NC} $1" >&2
    exit 1
}

info() {
    echo -e "${BLUE}info:${NC} $1" >&2
}

success() {
    echo -e "${GREEN}success:${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}warning:${NC} $1" >&2
}

detect_platform() {
    local os arch

    case "$(uname -s)" in
        Linux*)  os="linux" ;;
        Darwin*) os="darwin" ;;
        MINGW*|MSYS*|CYGWIN*) os="windows" ;;
        *) error "Unsupported operating system: $(uname -s)" ;;
    esac

    case "$(uname -m)" in
        x86_64|amd64) arch="x64" ;;
        arm64|aarch64) arch="arm64" ;;
        *) error "Unsupported architecture: $(uname -m)" ;;
    esac

    echo "${os}-${arch}"
}

get_latest_version() {
    local version
    version=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
    
    if [[ -z "$version" ]]; then
        error "Failed to fetch latest version. Check your internet connection."
    fi
    
    echo "$version"
}

download_binary() {
    local version="$1"
    local platform="$2"
    local tmp_dir="$3"
    
    local binary_suffix=""
    if [[ "$platform" == windows-* ]]; then
        binary_suffix=".exe"
    fi
    
    local download_url="https://github.com/${REPO}/releases/download/${version}/${BINARY_NAME}-${platform}${binary_suffix}"
    local output_path="${tmp_dir}/${BINARY_NAME}${binary_suffix}"
    
    info "Downloading ${BINARY_NAME} ${version} for ${platform}..."
    
    if ! curl -fsSL "$download_url" -o "$output_path" 2>/dev/null; then
        error "Failed to download binary from: ${download_url}"
    fi
    
    chmod +x "$output_path"
    echo "$output_path"
}

install_mise() {
    if ! command -v mise &> /dev/null; then
        info "Installing mise (tool version manager)..."
        curl https://mise.jdx.dev/install.sh | sh
        export PATH="$HOME/.local/bin:$PATH"
        export PATH="$HOME/.mise/shims:$PATH"
    fi
}

run_with_mise() {
    install_mise

    CLEANUP_DIR=$(mktemp -d)

    info "Cloning bakery..."
    git clone --depth 1 "https://github.com/${REPO}.git" "$CLEANUP_DIR/bakery" 2>/dev/null || \
        error "Failed to clone repository"

    cd "$CLEANUP_DIR/bakery"

    info "Installing tools with mise..."
    mise trust --all 2>/dev/null || true
    mise install

    eval "$(mise env)"

    info "Installing dependencies..."
    bun install --silent

    info "Starting wizard...\n"
    bun run src/cli.ts "$@"
}

main() {
    echo -e "\n${BOLD}${BLUE}Bakery Installer${NC}\n"

    local platform
    platform=$(detect_platform)
    info "Detected platform: ${platform}"

    local version="${BAKERY_VERSION:-}"
    local use_mise="${BAKERY_USE_MISE:-true}"

    if [[ "$use_mise" == "true" ]] || [[ "$use_mise" == "1" ]]; then
        run_with_mise "$@"
        exit 0
    fi

    if [[ -z "$version" ]]; then
        info "Fetching latest version..."
        version=$(get_latest_version)
    fi

    info "Version: ${version}"

    CLEANUP_DIR=$(mktemp -d)

    local binary_path
    binary_path=$(download_binary "$version" "$platform" "$CLEANUP_DIR")

    success "Downloaded successfully!\n"

    info "Starting wizard...\n"
    "$binary_path" "$@"
    
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        echo ""
        success "Project created! Don't forget to:"
        echo -e "  ${DIM}1.${NC} cd <project-name>"
        echo -e "  ${DIM}2.${NC} make install"
        echo -e "  ${DIM}3.${NC} make dev"
        echo ""
    fi
    
    exit $exit_code
}

main "$@"
