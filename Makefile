# gwfleet web console: Docker workflows for development and production.
# `make` (or `make help`) lists the targets.

-include .env

IMAGE ?= gwfleet-web
TAG ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo latest)
WEB_PORT ?= 8081
DEV_PORT ?= 5173
export IMAGE TAG WEB_PORT DEV_PORT

# Optional: CA file for a TLS-intercepting proxy, and extra `docker build` flags.
BUILD_CA ?=
DOCKER_BUILD_FLAGS ?=
comma := ,
BUILD_OPTS := $(if $(BUILD_CA),--secret id=ca$(comma)src=$(BUILD_CA)) $(DOCKER_BUILD_FLAGS)

COMPOSE_DEV := docker compose -f compose.dev.yaml
COMPOSE_PROD := docker compose -f compose.prod.yaml

.DEFAULT_GOAL := help
.PHONY: help dev-build dev dev-up dev-down dev-logs dev-shell dev-install check \
	prod-build prod-up prod-down prod-restart prod-logs prod-ps smoke clean

help: ## List the targets
	@awk 'BEGIN {FS = ":.*## "} /^[a-z-]+:.*## / {printf "  \033[1m%-13s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

## Development
dev-build: ## Build the dev image
	docker build --target dev -t gwfleet-web-dev:local $(BUILD_OPTS) .

dev: dev-build ## Dev server with hot reload in the foreground (http://localhost:5173 by default)
	$(COMPOSE_DEV) up

dev-up: dev-build ## Same, in the background
	$(COMPOSE_DEV) up -d
	@echo "Dev server: http://localhost:$(DEV_PORT)"

dev-down: ## Stop the dev server
	$(COMPOSE_DEV) down

dev-logs: ## Follow dev server logs
	$(COMPOSE_DEV) logs -f web

dev-shell: ## Shell in the dev container (npm, vitest, …)
	$(COMPOSE_DEV) run --rm web sh

dev-install: ## Reinstall node_modules in the container after package-lock.json changes
	$(COMPOSE_DEV) run --rm web npm ci --no-audit --no-fund

check: ## Lint, typecheck, test, build and size budget in a clean container (writes nothing here)
	docker build --target build $(BUILD_OPTS) .

## Production
prod-build: ## Build the production image, tagged with the git commit (runs every check first)
	docker build --target prod -t $(IMAGE):$(TAG) -t $(IMAGE):latest $(BUILD_OPTS) .

prod-up: prod-build ## Build and start the production container (http://localhost:8081 by default)
	$(COMPOSE_PROD) up -d --no-build
	@echo "Console: http://localhost:$(WEB_PORT)"

prod-down: ## Stop the production container
	$(COMPOSE_PROD) down

prod-restart: ## Restart without rebuilding (picks up .env changes)
	$(COMPOSE_PROD) up -d --no-build --force-recreate

prod-logs: ## Follow production logs
	$(COMPOSE_PROD) logs -f web

prod-ps: ## Show the production container and its health
	$(COMPOSE_PROD) ps

smoke: ## Check the running production container serves the app and its health endpoint
	@for i in $$(seq 1 30); do curl -fsS -o /dev/null http://localhost:$(WEB_PORT)/healthz && break; sleep 1; done
	curl -fsS http://localhost:$(WEB_PORT)/healthz
	curl -fsS http://localhost:$(WEB_PORT)/devices | grep -q '<div id="app">'
	@echo "Smoke test passed on port $(WEB_PORT)"

clean: ## Stop everything and remove the dev node_modules volume
	-$(COMPOSE_DEV) down -v
	-$(COMPOSE_PROD) down
