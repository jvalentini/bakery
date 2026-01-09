# ============================================
# Makefile for CLI Template
# TypeScript CLI Tool Generator
# ============================================

VERSION := $(shell node -p "require('./package.json').version")
BUILD_DATE := $(shell date -u +'%Y-%m-%dT%H:%M:%SZ')
VCS_REF := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

.DEFAULT_GOAL := help

# ============================================
# Help
# ============================================
.PHONY: help
help:
	@echo "CLI Template"
	@echo "============"
	@echo ""
	@echo "SETUP:"
	@echo "  make setup              - Install tools, create .env, install git hooks (idempotent)"
	@echo "  make check-env          - Verify environment setup"
	@echo ""
	@echo "DEVELOPMENT:"
	@echo "  make dev                - Run CLI in development mode (local)"
	@echo ""
	@echo "BUILD:"
	@echo "  make build              - Build TypeScript to dist/"
	@echo "  make build-binary       - Build binary for current platform"
	@echo "  make build-all          - Build binaries for all platforms"
	@echo ""
	@echo "TESTING:"
	@echo "  make test               - Run all tests"
	@echo "  make test-watch         - Run tests in watch mode"
	@echo "  make test-coverage      - Run tests with coverage"
	@echo ""
	@echo "LINTING:"
	@echo "  make lint               - Run biome + oxlint + knip with auto-fix"
	@echo "  make type-check         - Run TypeScript type checking"
	@echo ""
	@echo "DOCUMENTATION:"
	@echo "  make docs               - Generate API documentation"
	@echo "  make docs-watch         - Generate docs in watch mode"
	@echo "  make docs-serve         - Serve docs locally"
	@echo ""
	@echo "SECURITY:"
	@echo "  make security           - Run security scan (Trivy)"
	@echo "  make security-fix       - Show security fixes"
	@echo "  make audit              - Run npm audit"
	@echo ""
	@echo "DOCKER:"
	@echo "  make docker-dev         - Run development environment in Docker"
	@echo "  make docker-dev-down    - Stop Docker development environment"
	@echo "  make docker-test        - Run tests in Docker"
	@echo "  make docker-lint        - Run linting in Docker"
	@echo "  make docker-check       - Run all checks in Docker"
	@echo "  make docker-shell       - Open shell in Docker container"
	@echo "  make docker-build       - Build Docker image"
	@echo "  make docker-logs        - View Docker container logs"
	@echo ""
	@echo "RELEASE:"
	@echo "  make bump-patch         - Bump patch version (0.1.0 -> 0.1.1)"
	@echo "  make bump-minor         - Bump minor version (0.1.0 -> 0.2.0)"
	@echo "  make bump-major         - Bump major version (0.1.0 -> 1.0.0)"
	@echo "  make release            - Create GitHub release for current version"
	@echo "  make release-patch      - Bump patch + create release"
	@echo "  make release-minor      - Bump minor + create release"
	@echo "  make release-major      - Bump major + create release"
	@echo ""
	@echo "CLEANUP:"
	@echo "  make clean              - Remove caches, build artifacts, stop containers"
	@echo ""
	@echo "UTILITIES:"
	@echo "  make version            - Show version information"
	@echo "  make status             - Show git status"

# ============================================
# Setup (idempotent)
# ============================================
.PHONY: setup
setup:
	@echo ""
	@echo "CLI Template Setup"
	@echo "=================="
	@echo ""
	@# Check/install mise
	@printf "  mise .............. "
	@if command -v mise >/dev/null 2>&1; then \
		echo "✓ installed"; \
	else \
		echo "installing..."; \
		curl -sSL https://mise.run | sh; \
		echo ""; \
		echo "  ⚠ Add mise to your shell:"; \
		echo "    echo 'eval \"\$$(mise activate bash)\"' >> ~/.bashrc"; \
		echo "  Then restart your shell and run 'make setup' again."; \
		exit 1; \
	fi
	@# Check/install mise tools (bun, node, etc.)
	@printf "  mise tools ........ "
	@if mise list 2>/dev/null | grep -q "bun"; then \
		echo "✓ installed"; \
	else \
		echo "installing..."; \
		mise install --yes 2>/dev/null || mise install; \
		echo "  mise tools ........ ✓ installed"; \
	fi
	@# Check/install node_modules
	@printf "  node_modules ...... "
	@if [ -d node_modules ]; then \
		echo "✓ installed"; \
	else \
		echo "installing..."; \
		bun install; \
		echo "  node_modules ...... ✓ installed"; \
	fi
	@# Check/install lefthook git hooks
	@printf "  git hooks ......... "
	@if ! command -v lefthook >/dev/null 2>&1; then \
		echo "- skipped (lefthook not in PATH)"; \
	elif lefthook list 2>/dev/null | grep -q "pre-commit"; then \
		echo "✓ installed"; \
	else \
		lefthook install 2>/dev/null && echo "✓ installed" || echo "- failed"; \
	fi
	@echo ""
	@echo "Setup complete! Run 'make dev' to start."
	@echo ""

.PHONY: check-env
check-env:
	@echo "Environment Check"
	@echo "================="
	@printf "  mise:     "; mise --version 2>/dev/null || echo "not installed"
	@printf "  bun:      "; bun --version 2>/dev/null || echo "not in PATH"
	@printf "  node:     "; node --version 2>/dev/null || echo "not in PATH"
	@printf "  docker:   "; docker --version 2>/dev/null | head -1 || echo "not installed"
	@echo ""
	@printf "  node_modules: "; [ -d node_modules ] && echo "✓ installed" || echo "✗ run 'make install'"
	@printf "  .env:         "; [ -f .env ] && echo "✓ exists" || echo "- optional"

# ============================================
# Development (Local)
# ============================================
.PHONY: install
install:
	@bun install

.PHONY: dev
dev:
	@bun run dev

# ============================================
# Linting
# ============================================
.PHONY: lint
lint:
	@bun run lint:fix
	@bunx oxlint --fix .
	@echo ""
	@echo "Checking for unused code..."
	@-bunx knip --no-exit-code

.PHONY: type-check
type-check:
	@bunx tsc --noEmit

.PHONY: typecheck
typecheck:
	@bun run typecheck

.PHONY: check
check:
	@bun run check

# ============================================
# Testing
# ============================================
.PHONY: test
test:
	@bun test

.PHONY: test-watch
test-watch:
	@bun test --watch

.PHONY: test-coverage
test-coverage:
	@bun test --coverage

# ============================================
# Documentation
# ============================================
.PHONY: docs
docs:
	@echo "Generating API documentation..."
	@bunx typedoc
	@echo "Documentation generated in docs/"

.PHONY: docs-watch
docs-watch:
	@bun run docs:watch

.PHONY: docs-serve
docs-serve:
	@cd docs && python3 -m http.server 8080

# ============================================
# Security
# ============================================
.PHONY: security
security:
	@echo "Scanning for vulnerabilities..."
	@mise exec -- trivy fs --config trivy.yaml --scanners vuln --severity HIGH,CRITICAL .

.PHONY: security-fix
security-fix:
	@mise exec -- trivy fs --config trivy.yaml --format table .

.PHONY: audit
audit:
	@bun pm audit 2>/dev/null || echo "No audit available for bun, checking with npm..."
	@npm audit --audit-level=moderate 2>/dev/null || true

# ============================================
# Build
# ============================================
.PHONY: build
build:
	@bun run build

.PHONY: build-binary
build-binary:
	@bun build src/cli.ts --compile --outfile cli-template

.PHONY: build-all
build-all:
	@bun run build:binaries

# ============================================
# Docker
# ============================================
.PHONY: docker-dev
docker-dev:
	@echo "Starting CLI Template development..."
	@docker compose up -d
	@echo ""
	@echo "  CLI Template: http://localhost:3000"
	@echo ""
	@echo "Use 'make docker-logs' to view logs, 'make docker-dev-down' to stop"

.PHONY: docker-dev-down
docker-dev-down:
	@docker compose down
	@echo "All services stopped."

.PHONY: docker-test
docker-test:
	@docker compose run --rm test

.PHONY: docker-test-watch
docker-test-watch:
	@docker compose run --rm test-watch

.PHONY: docker-lint
docker-lint:
	@docker compose run --rm lint

.PHONY: docker-lint-fix
docker-lint-fix:
	@docker compose run --rm lint-fix

.PHONY: docker-format
docker-format:
	@docker compose run --rm format

.PHONY: docker-typecheck
docker-typecheck:
	@docker compose run --rm typecheck

.PHONY: docker-check
docker-check:
	@docker compose run --rm check

.PHONY: docker-shell
docker-shell:
	@docker compose run --rm shell

.PHONY: docker-build
docker-build:
	@docker build -t cli-template:latest --target production .

.PHONY: docker-logs
docker-logs:
	@docker compose logs -f

.PHONY: docker-clean
docker-clean:
	@docker compose down --rmi local --volumes --remove-orphans

.PHONY: bump-patch
bump-patch:
	@npm version patch --no-git-tag-version
	@NEW_VERSION=$$(node -p "require('./package.json').version"); \
	git add package.json; \
	git commit -m "chore: bump version to v$$NEW_VERSION"

.PHONY: bump-minor
bump-minor:
	@npm version minor --no-git-tag-version
	@NEW_VERSION=$$(node -p "require('./package.json').version"); \
	git add package.json; \
	git commit -m "chore: bump version to v$$NEW_VERSION"

.PHONY: bump-major
bump-major:
	@npm version major --no-git-tag-version
	@NEW_VERSION=$$(node -p "require('./package.json').version"); \
	git add package.json; \
	git commit -m "chore: bump version to v$$NEW_VERSION"

.PHONY: check-main-branch
check-main-branch:
	@CURRENT_BRANCH=$$(git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD); \
	if [ "$$CURRENT_BRANCH" != "main" ]; then \
		echo "Error: Releases can only be created on the main branch."; \
		exit 1; \
	fi

.PHONY: release
release: check-main-branch
	@git tag -a "v$(VERSION)" -m "Release v$(VERSION)" 2>/dev/null || true
	@git push origin "v$(VERSION)" 2>/dev/null || true
	@gh release create "v$(VERSION)" --title "v$(VERSION)" --generate-notes --latest

.PHONY: release-patch
release-patch: check-main-branch bump-patch
	@git push
	@$(MAKE) release

.PHONY: release-minor
release-minor: check-main-branch bump-minor
	@git push
	@$(MAKE) release

.PHONY: release-major
release-major: check-main-branch bump-major
	@git push
	@$(MAKE) release

# ============================================
# Cleanup
# ============================================
.PHONY: clean
clean:
	@echo "Cleaning..."
	@-docker compose down 2>/dev/null || true
	@-rm -rf node_modules/.vite node_modules/.cache .vite src/.vite 2>/dev/null || true
	@-rm -rf dist coverage docs bun.lockb cli-template-* 2>/dev/null || true
	@-rm -f *.tsbuildinfo tsconfig.*.tsbuildinfo 2>/dev/null || true
	@echo "Done."

.PHONY: clean-all
clean-all: clean docker-clean

.PHONY: version
version:
	@echo "Version: $(VERSION)"
	@echo "Build Date: $(BUILD_DATE)"
	@echo "VCS Ref: $(VCS_REF)"

.PHONY: status
status:
	@git status --short || echo "Not a git repository"
