# Default Components

These components are provided by the `@ratprez/entm` package and are available in all modules without any setup. They cover the most common FiveM entity and world use cases.

> **Package:** [`@ratprez/entm`](https://github.com/RatPrez/entm)

---

## Vec3

A three-component vector used throughout the framework.

```ts
import { Vec3 } from "@ratprez/entm";
```

```ts
class Vec3 {
    x: number;
    y: number;
    z: number;

    constructor(x?: number, y?: number, z?: number);

    static fromArray(coords: number[]): Vec3;
    static zero(): Vec3;
    static one(): Vec3;

    add(other: Vec3): Vec3;
    sub(other: Vec3): Vec3;
    scale(s: number): Vec3;
    dot(other: Vec3): number;
    cross(other: Vec3): Vec3;
    length(): number;
    lengthSquared(): number;
    normalize(): Vec3;
    distance(other: Vec3): number;
    clone(): Vec3;
    toArray(): [number, number, number];
}
```

All operations return new instances — `Vec3` is immutable by convention.

```ts
const a = new Vec3(1, 0, 0);
const b = new Vec3(0, 1, 0);
const c = a.add(b);                // Vec3(1, 1, 0)
const d = Vec3.fromArray([1,2,3]); // Vec3(1, 2, 3)
```

---

## Transform

General-purpose position/rotation/scale component. Use this for entities that don't spawn a FiveM native entity but still have a world position.

```ts
import { Transform, Vec3 } from "@ratprez/entm";
```

```ts
class Transform extends Component {
    position: Vec3;
    rotation: Vec3;
    scale:    Vec3;

    constructor(data: { position: Vec3; rotation: Vec3; scale: Vec3 });
}
```

```ts
const id = world.createEntity();
world.addComponent(id, new Transform({
    position: new Vec3(100, 200, 30),
    rotation: Vec3.zero(),
    scale:    Vec3.one(),
}));
```

---

## CfxEntity

Represents a live FiveM native entity (ped, vehicle, object) that has been spawned into the world. Added automatically by `EntitySystem` (client) and server spawn systems once a native entity is successfully created.

```ts
import { CfxEntity } from "@ratprez/entm";
```

```ts
class CfxEntity extends Component {
    readonly handle:     number;      // native entity handle
    readonly model:      number;      // model hash
    readonly entityType: number;      // 1 = ped, 2 = vehicle, 3 = object
    readonly netId:      number | null; // network ID if networked, null if local

    constructor(handle: number, model: number, entityType: number, netId: number | null);
}
```

`CfxEntity` is added to an entity **after** the native spawn succeeds. You can check for it to know whether the entity has a live game object:

```ts
const cfx = world.getComponent(id, CfxEntity);
if (!cfx) {
    // still spawning
}
```

Do not add `CfxEntity` manually unless you're managing the native entity lifecycle yourself.

---

## NetEntity

Marks an entity as networked. Holds the `netId` that links this ECS entity to its counterpart on other machines.

```ts
import { NetEntity } from "@ratprez/entm";
```

```ts
class NetEntity extends Component {
    readonly netId: number;

    constructor(netId: number);
}
```

Added automatically by the server-side `SyncSystem` when `world.createEntity(true)` is called. On clients, `SyncSystem` adds a `NetEntity` with the received `netId` when an `entity_create` event arrives.

You generally do not add or remove `NetEntity` manually. The presence of `NetEntity` on an entity is what triggers `onNetEntityCreated` / `onNetEntityDestroyed` on systems.

---

## WorldObject (abstract)

Base class for components that represent spawnable world objects — peds, vehicles, etc. Holds the data needed to spawn a native entity.

```ts
import { WorldObject, Vec3 } from "@ratprez/entm";
```

```ts
abstract class WorldObject extends Component {
    model:     number;
    position:  Vec3;
    rotation:  Vec3;
    networked: boolean;

    constructor(data: { model: number; position: Vec3; rotation: Vec3; networked: boolean });
}
```

Do not use `WorldObject` directly — use one of its concrete subclasses below. The `EntitySystem` (client) and server spawn logic watch for subclasses of `WorldObject` specifically.

---

## CPed *(client only)*

Signals that a ped should be spawned on the client. `EntitySystem` picks this up and calls `CreatePed`, then adds a `CfxEntity` component.

```ts
import { CPed, Vec3 } from "@ratprez/entm";
```

```ts
class CPed extends WorldObject {
    constructor(data: { model: number; position: Vec3; rotation: Vec3; networked: boolean });
}
```

```ts
const id = world.createEntity();
world.addComponent(id, new CPed({
    model:     GetHashKey("a_m_y_beach_01"),
    position:  new Vec3(200, -800, 31),
    rotation:  Vec3.zero(),
    networked: false,
}));
```

`EntitySystem` watches for `CPed` components and spawns a ped when one is added. If the model changes, the ped is automatically despawned and respawned. If the entity is destroyed, the ped is deleted.

If `networked: true`, the spawned ped is a networked entity and `CfxEntity.netId` will be set.

---

## CVehicle *(client only)*

Signals that a vehicle should be spawned on the client. Same lifecycle as `CPed` but uses `CreateVehicle`.

```ts
import { CVehicle, Vec3 } from "@ratprez/entm";
```

```ts
class CVehicle extends WorldObject {
    constructor(data: { model: number; position: Vec3; rotation: Vec3; networked: boolean });
}
```

```ts
const id = world.createEntity();
world.addComponent(id, new CVehicle({
    model:     GetHashKey("adder"),
    position:  new Vec3(100, -700, 30),
    rotation:  Vec3.zero(),
    networked: true,
}));
```

---

## SPed *(server only)*

Server-side ped request. Always networked (`networked: true` is set automatically).

```ts
import { SPed, Vec3 } from "@ratprez/entm";
```

```ts
class SPed extends WorldObject {
    constructor(data: { model: number; position: Vec3; rotation: Vec3 });
}
```

```ts
const id = world.createEntity();
world.addComponent(id, new SPed({
    model:    GetHashKey("a_m_y_beach_01"),
    position: new Vec3(200, -800, 31),
    rotation: Vec3.zero(),
}));
```

---

## SVehicle *(server only)*

Server-side vehicle request. Always networked.

```ts
import { SVehicle, Vec3 } from "@ratprez/entm";
```

```ts
class SVehicle extends WorldObject {
    constructor(data: { model: number; position: Vec3; rotation: Vec3 });
}
```

```ts
const id = world.createEntity();
world.addComponent(id, new SVehicle({
    model:    GetHashKey("adder"),
    position: new Vec3(100, -700, 30),
    rotation: Vec3.zero(),
}));
```

---

## Summary table

| Component | Side | Purpose |
|---|---|---|
| `Vec3` | shared | 3D vector math |
| `Transform` | shared | Position / rotation / scale (no native entity) |
| `CfxEntity` | shared | Live FiveM native entity handle |
| `NetEntity` | shared | Networked entity marker (netId) |
| `WorldObject` | shared | Abstract base for spawnable objects |
| `CPed` | client | Spawn a ped on the client |
| `CVehicle` | client | Spawn a vehicle on the client |
| `SPed` | server | Spawn a ped on the server |
| `SVehicle` | server | Spawn a vehicle on the server |

---

*docs written by claude and cleaned up by hand*
