# Road Quality Router Ukraine

Routing engine that calculates car routes optimised for road quality. Given two coordinates, it returns routes for four profiles simultaneously (quality, fastest, shortest, balanced) using pgRouting on top of OpenStreetMap data enriched with Waze incident signals.

## Architecture

```
┌─────────────────┐     POST /api/v1/route     ┌──────────────────────┐
│  React + MapLibre│ ◄─────────────────────────► │  Fastify API (Node)  │
│  localhost:5173  │                             │  localhost:3000      │
└─────────────────┘                             └──────────┬───────────┘
                                                           │
                                          ┌────────────────▼────────────────┐
                                          │  PostgreSQL 17 + PostGIS + pgRouting 3.7 │
                                          │  road_segments_noded (5.4M edges)│
                                          │  routing_edges (materialized view)│
                                          │  quality_scores (Waze + OSM)     │
                                          └──────────────────────────────────┘
```

**Stack:**
- API: Node.js + TypeScript + Fastify
- DB: PostgreSQL 17, PostGIS, pgRouting 3.7.3
- Frontend: React 18, Vite, MapLibre GL JS, Tailwind CSS
- OSM import: osm2pgsql 2.0.0 (flex output)
- Background jobs: pg-boss (Waze polling every 5 min)

## Quick start

### Prerequisites
- Docker + Docker Compose
- Node.js 20+
- ~4 GB RAM for the DB container (Ukraine full dataset)

### 1. Clone and install
```bash
git clone <repo>
cd road-quality-router
npm install
make web-install
```

### 2. Start the database
```bash
make up
make migrate
```

### 3. Load road data

**Option A — dev seed** (~80 Kyiv streets, instant):
```bash
make seed
make topology     # ~2 min
```

**Option B — full Ukraine OSM** (~350 MB download, 2–3 h total):
```bash
make osm-import   # downloads + imports OSM PBF
make calc-scores  # scores every segment
make topology     # pgr_nodeNetwork + pgr_createTopology (~2 h)
```

### 4. Start the API
```bash
make dev          # API on http://localhost:3000
```

### 5. Start the frontend
```bash
make web-dev      # UI on http://localhost:5173
```

Open http://localhost:5173, click two points on the map — origin and destination. All four route profiles are calculated in parallel and cached; switching between them is instant.

## Routing profiles

| Profile | Cost function |
|---------|---------------|
| `quality` | `length × (1 / quality_score) × road_penalty` |
| `shortest` | `length × road_penalty` |
| `fastest` | `length / speed_limit × road_penalty` |
| `balanced` | `length × 0.5 + length × (0.5 / quality_score) × road_penalty` |

`road_penalty` multiplies the cost for non-car road types (footway ×80, cycleway ×80, path ×40, steps ×200) to keep car routes on actual roads.

## Road quality score

Each segment has a score 0–100 computed from three layers:

```
final_score = osm_base_score
            - dynamic_penalty  × 0.30   (Waze incidents)
            - acc_penalty      × 0.20   (accelerometer reports)
            - temporal_penalty × 0.10   (time-decay factor)
```

**OSM base score** uses road type, surface material, speed limit, and lane count.
**Dynamic penalty** comes from Waze alerts (POTHOLE=15, ACCIDENT=20, ROAD_CLOSED=25, HAZARD=12, JAM=5).

Segments are coloured on the map: green (≥70), yellow (≥40), red (<40).

## API

### `POST /api/v1/route`

```json
{
  "origin":      { "lat": 50.4501, "lon": 30.5234 },
  "destination": { "lat": 50.5936, "lon": 32.4043 },
  "profile":     "quality"
}
```

Always returns all four profiles regardless of the `profile` field (accepted for compatibility):

```json
{
  "routes": [
    {
      "profile":      "quality",
      "distanceKm":   145.7,
      "durationMin":  116,
      "qualityIndex": 79.1,
      "segments":     [...],
      "geometry":     { "type": "LineString", "coordinates": [...] }
    }
  ],
  "meta": { "engine": "pgrouting-v1", "alpha": 1.0 }
}
```

### `GET /health`

Returns `200 { "status": "ok" }` when the database is reachable.

## Make targets

```
make up            Start Docker containers
make down          Stop containers
make migrate       Apply DB migrations (idempotent — tracks applied files)
make seed          Insert ~80 dev Kyiv segments
make osm-import    Download and import Ukraine OSM PBF
make calc-scores   Score all road segments from OSM data
make topology      Build pgRouting topology (pgr_nodeNetwork + pgr_createTopology)
make refresh-view  Refresh routing_edges after score updates
make dev           Start API dev server (hot reload)
make web-dev       Start frontend dev server
make web-build     Build frontend for production
make logs          Tail API logs
make waze-logs     Tail Waze worker logs
make waze-jobs     Inspect pg-boss job queue
make reset         Destroy all data and rebuild from scratch (dev only)
```

## Environment variables

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://rqr:rqr_dev@localhost:5432/rqr` | Postgres connection |
| `PORT` | `3000` | API listen port |
| `ROUTING_ALPHA` | `1.0` | Quality weight in cost formula |
| `WEIGHT_DYNAMIC` | `0.30` | Waze penalty weight |
| `WEIGHT_ACCELEROMETER` | `0.20` | Accelerometer penalty weight |
| `WEIGHT_TEMPORAL` | `0.10` | Time-decay penalty weight |
| `WAZE_FETCH_INTERVAL_MINUTES` | `5` | Waze polling interval |
| `WAZE_UKRAINE_BBOX` | `30.2,50.2,30.8,50.7` | Waze fetch bounding box |
| `WAZE_API_URL` | `https://www.waze.com/row-rtserver/web/TGeoRSS` | Waze LiveMap endpoint |
| `WAZE_FETCH_TIMEOUT_MS` | `15000` | Waze HTTP timeout |

## Project structure

```
packages/
  api/
    src/
      db/
        migrations/   SQL migrations (001–007)
      routes/         Fastify route handlers
      services/       pgRoutingService, wazeService, qualityUpdater
      scoring/        OSM scoring, aggregator, constants
      workers/        Waze pg-boss worker
    scripts/          buildTopology, calcScores, migrate, seed
  web/
    src/
      components/
        MapView/      MapLibre map, route layer, markers
        Sidebar/      Profile switcher, route stats
      hooks/          useRoute, useMapClick
      api/            fetchRoute
infra/
  osm2pgsql/          ukraine.lua flex style
  postgres/           init.sql
```
