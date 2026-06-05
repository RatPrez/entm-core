# System

Systems contain all the logic. A system runs over entities — querying components via the world, reacting to events, and mutating state.

> **Package:** [`@ratprez/entm`](https://github.com/RatPrez/entm)

---

## Base class

```ts
import { System } from "@ratprez/entm";
import type { World } from "@ratprez/entm";

class MySystem extends System {
    override update(dt: number): void {
        // runs every frame
    }
}
```

All systems extend `System`. Override only the methods you need — the framework detects which callbacks are implemented via prototype comparison at `addSystem` time. There is no per-tick reflection overhead.

The constructor receives the `World` instance, which is stored as `protected m_world: World`. You always have access to the world.

---

## Registering a system

```ts
world.addSystem(new MySystem(world));
```

At `addSystem` time, the framework checks each overridable method against `System.prototype`. If your class provides its own implementation, a `m_has*` boolean flag is stamped onto the instance. Only systems with a given flag set are called for that callback each tick.

Systems are keyed by constructor. You can only have one instance of a given system class registered at a time.

---

## Removing a system

```ts
world.removeSystem(MySystem);
```

Calls `onEnd` if implemented, then removes the system from the world.

---

## Retrieving a system

```ts
const sys = world.getSystem(MySystem); // MySystem | null
```

Useful when systems need to communicate.

---

## Overridable methods

### `update(deltaTime: number): void`

Runs every frame. `deltaTime` is seconds elapsed since the last frame, capped at 0.25 seconds to prevent spiral-of-death.

```ts
override update(dt: number): void {
    for (const { entityId, health } of this.m_world.view(Health)) {
        if (health.current <= 0) {
            this.m_world.destroyEntity(entityId);
        }
    }
}
```

### `updateFixed(fixedTime: number): void`

Runs at a fixed rate of **30 Hz** (every ~33ms), using an accumulator. `fixedTime` is the fixed timestep value (always `1/30`). Use this for physics, spawn logic, or anything that should be rate-limited.

```ts
override updateFixed(fixedTime: number): void {
    for (const { entityId, cPed } of this.m_world.view(CPed)) {
        // spawn logic, etc.
    }
}
```

### `onStart(): void`

Called once when `world.addSystem(...)` is called. Use this for initialization — registering event handlers, loading data, etc.

```ts
override onStart(): void {
    on('playerSpawned', () => { /* ... */ });
}
```

### `onEnd(): void`

Called when the system is removed (`world.removeSystem`) or when the resource stops. Use this for cleanup — deleting entities, unregistering handlers, etc.

```ts
override onEnd(): void {
    for (const { entityId } of this.m_world.view(CfxEntity)) {
        this.m_world.destroyEntity(entityId);
    }
}
```

### `onEntityCreated(id: EntityId): void`

Called whenever any entity is created via `world.createEntity(...)`.

```ts
override onEntityCreated(id: EntityId): void {
    console.log(`entity ${id} created`);
}
```

### `onEntityDestroyed(id: EntityId): void`

Called just before an entity is destroyed. All of the entity's components are still accessible at this point.

```ts
override onEntityDestroyed(id: EntityId): void {
    const cfx = this.m_world.getComponent(id, CfxEntity);
    if (cfx && DoesEntityExist(cfx.handle)) {
        DeleteEntity(cfx.handle);
    }
}
```

### `onNetEntityCreated(id: EntityId): void`

Called when a **synced** entity is created — i.e. `world.createEntity(true)` on the server. Only fires server-side.

```ts
override onNetEntityCreated(id: EntityId): void {
    this.m_world.addComponent(id, new NetEntity(id));
    TriggerClientEvent("entm-core:cl:entity_create", -1, id);
}
```

### `onNetEntityDestroyed(id: EntityId): void`

Called when a synced entity is destroyed, or when a `NetEntity` component is removed from an entity.

### `onComponentAdded(id: EntityId, sType: string): void`

Called after any component is added to any entity. `sType` is the component's camelCase class name (e.g. `"health"`, `"cfxEntity"`).

```ts
override onComponentAdded(id: EntityId, sType: string): void {
    if (sType !== "health") return;
    console.log(`entity ${id} gained Health component`);
}
```

### `onComponentRemoved(id: EntityId, sType: string): void`

Called just before a component is removed. The component is still accessible via `world.getComponent` at this point.

```ts
override onComponentRemoved(id: EntityId, sType: string): void {
    if (sType !== "cPed" && sType !== "cVehicle") return;
    const cfx = this.m_world.getComponent(id, CfxEntity);
    if (cfx) DeleteEntity(cfx.handle);
}
```

---

## Accessing the world

All systems have `protected m_world: World` available. Use it to query components, create/destroy entities, and interact with other systems.

```ts
class MySystem extends System {
    override update(dt: number): void {
        // query entities
        for (const { entityId, health, transform } of this.m_world.view(Health, Transform)) {
            // ...
        }

        // get a specific component
        const hp = this.m_world.getComponent(someId, Health);

        // talk to another system
        const other = this.m_world.getSystem(OtherSystem);
    }
}
```

---

## Type reference

```ts
class System {
    constructor(world: World);

    update(deltaTime: number): void;
    updateFixed(fixedTime: number): void;
    onStart(): void;
    onEnd(): void;
    onEntityCreated(id: EntityId): void;
    onEntityDestroyed(id: EntityId): void;
    onNetEntityCreated(id: EntityId): void;
    onNetEntityDestroyed(id: EntityId): void;
    onComponentAdded(id: EntityId, sType: string): void;
    onComponentRemoved(id: EntityId, sType: string): void;

    protected m_world: World;
}
```

---

*docs written by claude and cleaned up by hand*
