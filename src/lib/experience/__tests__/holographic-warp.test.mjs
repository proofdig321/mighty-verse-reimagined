import { holographicPanFromPointerX, holographicMouseUv, holographicUvShift, tessellatePlane, tessellateVertexCount } from "../holographic-warp";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(holographicPanFromPointerX(-0.5) === -0.8, "mouse left pans audio to the left ear");
assert(holographicPanFromPointerX(0.5) === 0.8, "mouse right pans audio to the right ear");
assert(holographicPanFromPointerX(0) === 0, "center pointer is center pan");
assert(holographicPanFromPointerX(-2) === -0.8, "pan is clamped");

const left = holographicMouseUv({ x: -0.5, y: 0 });
assert(left.x === 0, "left pointer maps to mouse uv 0");
const right = holographicMouseUv({ x: 0.5, y: 0 });
assert(right.x === 1, "right pointer maps to mouse uv 1");

assert(holographicUvShift(0, 0.45) < 0, "mouse left yields a negative UV shift (pixels appear to slide right)");
assert(holographicUvShift(1, 0.45) > 0, "mouse right yields a positive UV shift (pixels appear to slide left)");

const mesh = tessellatePlane(4);
assert(mesh.length === tessellateVertexCount(4) * 5, "tessellated plane stores x,y,z,u,v per vertex");
assert(tessellateVertexCount(64) === 64 * 64 * 6, "production mesh is a 64x64 triangle grid");

console.log("holographic-warp.test.mjs: ok");
