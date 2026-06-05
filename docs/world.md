# World

The `World` is the central object. It owns all entities, all component pools, and all systems. There is one world per side (client / server) managed by entm-core. Modules receive a reference to it in their `__registerModule` callback.

> **Package:** [`@ratprez/entm`](https://github.com/RatPrez/entm)

---

## Entities

### `createEntity(synced?: boolean): EntityId`

Creates a new entity and returns its numeric ID. Entity IDs are recycled when entities are destroyed.

```ts
const id = world.createEntity();
```

Pass `true` to create a **synced** entity on the server. This triggers `onNetEntityCreated` on all systems, which causes the `SyncSystem` to broadcast the entity to all clients.

```ts
const id = world.createEntity(true); // server only
```

`EntityId` is just `number`.

### `destroyEntity(id: EntityId): void`

Destroys the entity and all its components. Fires `onEntityDestroyed` on all relevant systems before removal. If the entity has a `NetEntity` component, `onNetEntityDestroyed` fires as well.

```ts
world.destroyEntity(id);
```

### `hasEntity(id: EntityId): boolean`

Returns `true` if the entity exists in the world.

```ts
if (world.hasEntity(id)) {
    // safe to use
}
```

### `getEntityCount(): number`

Returns the total number of live entities.

```ts
console.log(`entities alive: ${world.getEntityCount()}`);
```

---

## Components

### `addComponent<T>(id: EntityId, component: T): T`

Attaches a component to an entity. Returns the stored component instance (which may differ if the entity already had this component type — in that case the existing instance is returned).

```ts
const health = world.addComponent(id, new Health(100));
```

Fires `onComponentAdded` on all systems with that callback. If the component is `@sync('full')`, it is wrapped in a Proxy before being stored.

### `getComponent<T>(id: EntityId, ctor: new (...) => T): T | null`

Returns the component of type `ctor` on the entity, or `null` if it doesn't exist.

```ts
const health = world.getComponent(id, Health);
if (health) {
    health.current -= 10;
}
```

### `removeComponent<T>(id: EntityId, ctor: new (...) => T): void`

Removes a component from an entity. Fires `onComponentRemoved` on all systems with that callback before removal.

```ts
world.removeComponent(id, Health);
```

### `getPool<T>(ctor: new (...) => T): ComponentPool<T> | null`

Returns the raw `ComponentPool` for a component type, or `null` if no pool exists yet. Useful for low-level iteration when you don't need a `View`.

```ts
const pool = world.getPool(Health);
if (pool) {
    for (let i = 0; i < pool.size(); i++) {
        const entity = pool.entityAt(i);
        const comp   = pool.at(i);
    }
}
```

---

## Views

`view()` creates a typed query over the world. It iterates the primary component pool and filters to entities that also have all secondary components.

Views are generator-based — no intermediate array is allocated. The result object for each entity has an `entityId` field plus one field per component, keyed by the component's camelCase class name.

### Single component

```ts
for (const { entityId, health } of world.view(Health)) {
    console.log(entityId, health.current);
}
```

### Two components

```ts
for (const { entityId, health, transform } of world.view(Health, Transform)) {
    // entity has both Health and Transform
}
```

### Three components

```ts
for (const { entityId, health, transform, velocity } of world.view(Health, Transform, Velocity)) {
    // entity has all three
}
```

### Four components

```ts
for (const { entityId, a, b, c, d } of world.view(A, B, C, D)) {
    // entity has all four
}
```

You can also use `.each()` instead of a `for...of` loop:

```ts
world.view(Health).each(({ entityId, health }) => {
    health.current = health.max;
});
```

> The iteration order is determined by the primary (first) component pool. Entities are iterated in insertion order for that pool.

### ViewResult type

```ts
type ViewResult<T extends Component[]> =
    { entityId: EntityId } &
    { [K in T[number] as K['sType']]: K };
```

The field names are the `sType` values (camelCase class names). For `world.view(Health)`, the result has `{ entityId, health: Health }`.

---

## Systems

### `addSystem(system: System): void`

Registers a system. Stamps the `m_has*` flags by comparing each overridable method against `System.prototype` — this is a one-time cost at registration, not per-tick. Calls `onStart` if implemented.

```ts
world.addSystem(new HealthSystem(world));
```

Systems are stored by constructor. Adding a second instance of the same class replaces the first.

### `removeSystem<T>(ctor: new (...) => T): void`

Removes a system by constructor. Calls `onEnd` if implemented.

```ts
world.removeSystem(HealthSystem);
```

### `getSystem<T>(ctor: new (...) => T): T | null`

Returns the registered instance of a system, or `null`.

```ts
const sys = world.getSystem(HealthSystem);
```

---

## Game loop

entm-core drives the loop. The world's `update` and `updateFixed` are called from a `setTick`. You don't call these yourself from your module code.

- `update(deltaTime)` — called every frame. `deltaTime` is seconds, capped at 0.25s.
- `updateFixed(fixedTime)` — called at ~30 Hz via an accumulator. `fixedTime` is always `1/30`.

---

## Type reference

```ts
class World {
    // entities
    createEntity(synced?: boolean): EntityId;
    destroyEntity(id: EntityId): void;
    hasEntity(id: EntityId): boolean;
    getEntityCount(): number;

    // components
    addComponent<T extends Component>(id: EntityId, component: T): T;
    getComponent<T extends Component>(id: EntityId, ctor: new (...args: any[]) => T): T | null;
    removeComponent<T extends Component>(id: EntityId, ctor: new (...args: any[]) => T): void;
    getPool<T extends Component>(ctor: new (...args: any[]) => T): ComponentPool<T> | null;

    // views
    view<A>(a: ctor<A>): View<[A]>;
    view<A, B>(a: ctor<A>, b: ctor<B>): View<[A, B]>;
    view<A, B, C>(a: ctor<A>, b: ctor<B>, c: ctor<C>): View<[A, B, C]>;
    view<A, B, C, D>(a: ctor<A>, b: ctor<B>, c: ctor<C>, d: ctor<D>): View<[A, B, C, D]>;

    // systems
    addSystem(system: System): void;
    removeSystem<T extends System>(ctor: new (...args: any[]) => T): void;
    getSystem<T extends System>(ctor: new (...args: any[]) => T): T | null;

    // misc
    setProfiler(profiler: Profiler): void;
    syncQueue: SyncQueue;
}
```

---

*docs written by claude and cleaned up by hand*
