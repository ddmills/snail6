import { dijkstra } from "../lib/dijkstra";
import { cache, player, gameState } from "../state/ecs";
import { grid } from "../lib/settings";
import { cellToId } from "../lib/grid";
import MoveTo from "../components/MoveTo";
import { blockingEntities, movableEntities } from "../queries";

export const movement = () => {
  movableEntities.get().forEach((entity) => {
    const mPos = {
      x: entity.position.x + entity.moveTo.x,
      y: entity.position.y + entity.moveTo.y,
    };

    const { width, height, x, y } = grid.map;

    // observe map boundaries
    const mx = Math.min(width + x - 1, Math.max(x, mPos.x));
    const my = Math.min(height + y - 1, Math.max(y, mPos.y));

    let hasBlockers = false;

    blockingEntities.get().forEach((e) => {
      if (e.position.x === mx && e.position.y === my && e.isBlocking) {
        hasBlockers = true;
      }
    });

    if (hasBlockers) {
      return entity.remove(MoveTo);
    }

    // update cache
    cache.delete("entitiesAtLocation", cellToId(entity.position), entity.id);
    cache.addSet("entitiesAtLocation", cellToId({ x: mx, y: my }), entity.id);

    if (entity.id === player.id && gameState.playerTurn) {
      const playerDijkstraMap = dijkstra([{ x: mx, y: my }]);
      cache.addObj("dijkstraMaps", "player", playerDijkstraMap);
    }

    entity.position.x = mx;
    entity.position.y = my;

    entity.remove(MoveTo);
  });
};
