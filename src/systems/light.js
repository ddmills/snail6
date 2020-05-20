import Color from "color";

import ecs, { cache, player } from "../state/ecs";
import { grid } from "../lib/canvas";
import createFov from "../lib/fov";
import { cellToId, getNeighborIds } from "../lib/grid";

import Light from "../components/Light";

import {
  hasMovedEntities,
  lightSourcesEntities,
  litEntities,
  opaqueEntities,
  opaqueNonLightSourceEntities,
  inFovEntities,
} from "../queries";

const gridWidth = grid.width;
const gridHeight = grid.height;

export const light = () => {
  // first remove all lightsources ONLY for entities that have moved!
  const movedEntities = [...hasMovedEntities.get()].map((x) => x.id);
  litEntities.get().forEach((entity) => {
    entity.light.sources.forEach((eId) => {
      if (movedEntities.includes(eId)) {
        entity.light.sources.delete(eId);
        if (!entity.light.sources.size) {
          entity.remove(Light);
        }
      }
    });
  });

  // initial lighting
  lightSourcesEntities.get().forEach((lsEntity) => {
    const {
      light,
      lightSource: { range },
      position: { x: originX, y: originY },
      hasMoved,
    } = lsEntity;

    // ONLY do this if lighsource hasMoved or has not been lit (the first time)
    // todo: maybe check if it's in player FOV?
    if (hasMoved || !light) {
      const { fov, distance } = createFov(
        opaqueEntities,
        gridWidth,
        gridHeight,
        originX,
        originY,
        range
      );

      fov.forEach((locId) => {
        const opacity = ((range - distance[locId]) / range) * 100;

        const entitiesAtLoc = cache.readSet("entitiesAtLocation", locId);

        if (entitiesAtLoc) {
          entitiesAtLoc.forEach((eId) => {
            const entity = ecs.getEntity(eId);
            if (!entity.has("IsOpaque")) {
              if (entity.has("Light")) {
                // need to somehow check lightsour

                // entity.light.a = entity.light.a + opacity;
                entity.light.a = opacity;
              } else {
                entity.add("Light", { a: opacity });
              }

              if (entity.light.sources) {
                entity.light.sources.add(lsEntity.id);
              } else {
                entity.light.sources = new Set([lsEntity.id]);
              }
            }

            if (entity.has("LightSource")) {
              if (entity.has("Light")) {
                entity.light.a = 100;
              } else {
                entity.add("Light", { a: 100 });
              }

              if (entity.light.sources) {
                entity.light.sources.add(lsEntity.id);
              } else {
                entity.light.sources = new Set([lsEntity.id]);
              }
            }
          });
        }
      });
    }
  });

  // light source mixing
  litEntities.get().forEach((entity) => {
    const { appearance, light } = entity.components;

    if (light) {
      light.sources.forEach((sourceId) => {
        const { color, weight } = ecs.getEntity(sourceId).lightSource;
        const fg = Color(appearance.color).alpha(light.a / 100);
        const mixedColor = fg.mix(Color(color), weight);
        entity.light.color = mixedColor;
      });
    }
  });

  // Opaque entities lighting
  // These should only do the walls that are withing light range of sources
  const fov = new Set(
    [...inFovEntities.get()].map((x) => cellToId(x.position))
  );

  opaqueNonLightSourceEntities.get().forEach((entity) => {
    let brightestLight = 0;
    let light = null;

    // get all of it's neighbors
    const locIds = getNeighborIds(
      entity.position.x,
      entity.position.y
    ).filter((locId) => fov.has(locId));

    // get brightest light from all neighbors and set light to that
    // if no neighors are lit - stay dark :)
    locIds.forEach((locId) => {
      const entitiesAtLoc = cache.readSet("entitiesAtLocation", locId);
      if (entitiesAtLoc) {
        entitiesAtLoc.forEach((id) => {
          const e = ecs.getEntity(id);
          if (e.light && !e.isOpaque) {
            if (brightestLight < e.light.a) {
              brightestLight = e.light.a;
              light = {
                a: e.light.a,
                sources: e.light.sources,
              };
            }

            // if (brightestLight === 0) {
            //   e.light.a = 0;
            // }
          }
        });
      }
    });

    if (brightestLight) {
      if (entity.has(Light)) {
        entity.remove(Light);
      }
      entity.add(Light, light);

      entity.light.sources.forEach((sourceId) => {
        const { color, weight } = ecs.getEntity(sourceId).lightSource;
        let fg = Color(entity.appearance.color).alpha(light.a / 100);

        const mixedColor = fg.mix(Color(color), weight);
        entity.light.color = mixedColor;
      });
    }
  });
};
