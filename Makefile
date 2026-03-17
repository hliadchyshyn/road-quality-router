.PHONY: up down migrate seed topology calc-scores refresh-view dev test logs waze-logs waze-jobs \
        osm-download osm-import reset install web-install web-dev web-build

# ── Docker ────────────────────────────────────────────────────────────────────

up:
	docker-compose up -d
	@echo "Waiting for DB to be ready..."
	@sleep 3

down:
	docker-compose down

logs:
	docker-compose logs -f api

# ── Database ──────────────────────────────────────────────────────────────────

migrate:
	cd packages/api && npm run migrate

# Phase 1 seed: ~80 Kyiv streets (dev/testing only)
seed:
	cd packages/api && npm run seed

# Phase 3: build pgRouting topology (run after seed or calc-scores)
topology:
	cd packages/api && npm run topology

# Phase 3: transform osm_ways → road_segments + quality_scores
calc-scores:
	cd packages/api && npm run calc-scores

# Refresh routing_edges materialized view (run after score updates)
refresh-view:
	cd packages/api && npm run refresh-view

# ── OSM import (Phase 3) ──────────────────────────────────────────────────────

DATA_DIR := $(PWD)/data
PBF_FILE := $(DATA_DIR)/ukraine-latest.osm.pbf
OSM_URL  := https://download.geofabrik.de/europe/ukraine-latest.osm.pbf

# Download Ukraine OSM extract from Geofabrik (~350 MB)
osm-download:
	@mkdir -p $(DATA_DIR)
	@if [ -f "$(PBF_FILE)" ]; then \
		echo "$(PBF_FILE) already exists, skipping download."; \
	else \
		echo "Downloading Ukraine OSM extract..."; \
		curl -L --progress-bar "$(OSM_URL)" -o "$(PBF_FILE)"; \
	fi

# Import PBF into osm_ways staging table via osm2pgsql (flex output)
# Requires make up && make migrate first.
# Uses Docker so osm2pgsql doesn't need to be installed locally.
osm-import: osm-download
	@echo "Running osm2pgsql (this may take 10-20 min for Ukraine)..."
	docker run --rm \
		--network road-quality-router_default \
		-v "$(PBF_FILE):/data/ukraine.pbf:ro" \
		-v "$(PWD)/infra/osm2pgsql:/lua:ro" \
		osm2pgsql/osm2pgsql:2.0.0 \
		osm2pgsql \
			--slim --drop \
			-d "postgresql://$${POSTGRES_USER:-rqr}:$${POSTGRES_PASSWORD:-rqr_dev}@db:5432/$${POSTGRES_DB:-rqr}" \
			--output=flex --style=/lua/ukraine.lua \
			/data/ukraine.pbf
	@echo "Import done. Run: make calc-scores && make topology"

# ── App ───────────────────────────────────────────────────────────────────────

dev:
	cd packages/api && npm run dev

install:
	npm install

# ── Frontend (Phase 4) ────────────────────────────────────────────────────────

web-install:
	cd packages/web && npm install

web-dev:
	cd packages/web && npm run dev

web-build:
	cd packages/web && npm run build

test:
	cd packages/api && npm test

# ── Observability ─────────────────────────────────────────────────────────────

waze-logs:
	docker-compose logs -f api | grep -i waze

waze-jobs:
	docker-compose exec db psql -U $${POSTGRES_USER:-rqr} -d $${POSTGRES_DB:-rqr} \
		-c "SELECT id, name, state, createdon, completedon, data FROM pgboss.job ORDER BY createdon DESC LIMIT 20;"

# ── Reset (dev only — destroys all data) ─────────────────────────────────────

reset: down
	docker volume rm road-quality-router_pgdata || true
	$(MAKE) up
	sleep 5
	$(MAKE) migrate
	$(MAKE) seed
	$(MAKE) topology
