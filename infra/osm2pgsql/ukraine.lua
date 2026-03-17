-- osm2pgsql flex output script for Road Quality Router Ukraine
--
-- Reads OSM way data and writes highway features to the osm_ways staging table.
-- Run via: osm2pgsql --output=flex --style=ukraine.lua ukraine-latest.osm.pbf
--
-- Highway types to import (must match ROAD_TYPE_BASE in scoring/constants.ts)

local HIGHWAY_KEEP = {
  motorway      = true,
  motorway_link = true,
  trunk         = true,
  trunk_link    = true,
  primary       = true,
  primary_link  = true,
  secondary     = true,
  secondary_link = true,
  tertiary      = true,
  tertiary_link = true,
  unclassified  = true,
  residential   = true,
  living_street = true,
  service       = true,
  track         = true,
  path          = true,
  footway       = true,
}

-- Output table — matches the osm_ways schema defined in 004_osm_staging.sql
local roads = osm2pgsql.define_table({
  name = 'osm_ways',
  ids  = { type = 'way', id_column = 'osm_way_id' },
  columns = {
    { column = 'geom',     type = 'linestring', projection = 4326, not_null = true },
    { column = 'highway',  type = 'text',       not_null = true },
    { column = 'surface',  type = 'text' },
    { column = 'name',     type = 'text' },
    { column = 'maxspeed', type = 'int' },
    { column = 'lanes',    type = 'int' },
  },
})

-- Only ways are relevant for road segments
function osm2pgsql.process_way(object)
  local highway = object.tags.highway
  if not highway or not HIGHWAY_KEEP[highway] then return end

  -- Prefer Ukrainian name, fall back to generic name
  local name = object.tags['name:uk'] or object.tags.name

  -- Parse maxspeed: "50" or "50 mph" — take leading integer only
  local speed_raw = object.tags.maxspeed
  local maxspeed  = speed_raw and tonumber(speed_raw:match('^%d+')) or nil

  local lanes = tonumber(object.tags.lanes)

  roads:insert({
    geom     = object:as_linestring(),
    highway  = highway,
    surface  = object.tags.surface,
    name     = name,
    maxspeed = maxspeed,
    lanes    = lanes,
  })
end
