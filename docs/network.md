# Network

entm-core provides a server-to-client sync system for components. It uses FiveM network events internally and requires no manual event wiring on your part.

> **Package:** [`@ratprez/entm`](https://github.com/RatPrez/entm)

---

> **Known bug:** Defining a custom constructor on a `@sync` component currently causes a failed build. Use field defaults instead of a constructor. This is being investigated.
>
> ```ts
> // Don't do this on a @sync component
> @sync('full')
> class Health extends Component {
>     current: number;
>     constructor(max: number) { super(); this.current = max; }
> }
>
> // Do this instead
> @sync('full')
> class Health extends Component {
>     current: number = 100;
> }
> ```

---

## Overview

The sync flow is:

1. Server creates a **synced entity** via `world.createEntity(true)`.
2. `SyncSystem` (server) broadcasts `entity_create` to all clients.
3. Clients create a mirrored entity and map it by `netId`.
4. When a `@sync` component is added on the server, the component's data is broadcast to all clients and applied to the mirrored entity.
5. When the entity is destroyed, clients destroy their mirrored entity.

Sync is **server → clients** only. There is no client → server data replication in the base framework.

---

## Synced entities

On the server, pass `true` to `createEntity` to create a synced entity:

```ts
const id = world.createEntity(true);
```

This triggers `onNetEntityCreated` on all systems, which causes the built-in `SyncSystem` to:
- Add a `NetEntity` component with the entity's ID as its `netId`.
- Broadcast `entm-core:cl:entity_create` to all clients.

Clients receive the event and create a local entity, then store the `netId → entityId` mapping internally.

---

## `@sync('full')`

A component decorated with `@sync('full')` has its fields continuously replicated to clients.

```ts
import { Component, sync } from "@ratprez/entm";

@sync('full')
export class Position extends Component {
    x: number = 0;
    y: number = 0;
    z: number = 0;
}
```

On the server, when you call `world.addComponent(id, new Position())`, the component is wrapped in a `Proxy`. Every time a field is assigned:

```ts
const pos = world.getComponent(id, Position)!;
pos.x = 100; // queued for sync
pos.y = 200; // queued for sync
```

Those mutations are pushed onto the `SyncQueue`. The server-side `SyncSystem` flushes the queue on every fixed tick (30 Hz) and broadcasts the aggregated payload to all clients.

Payloads under 1024 bytes are sent via `TriggerClientEvent`. Larger payloads use `TriggerLatentClientEvent` (25 kbps bandwidth limit) to avoid saturating the network event queue.

---

## `@sync('life')`

A component decorated with `@sync('life')` syncs only its **presence** — not its field values.

```ts
import { Component, sync } from "@ratprez/entm";

@sync('life')
export class IsDead extends Component {}
```

When added to an entity on the server, clients receive a `sync_life` event and add the same component to their mirrored entity. When removed on the server, clients remove it as well.

Use this for state flags or lightweight markers where the fields don't matter.

---

## `@ignore`

Excludes a field from the sync payload even on a `@sync('full')` component. The field stays server-side only.

```ts
import { Component, sync, ignore } from "@ratprez/entm";

@sync('full')
export class PlayerState extends Component {
    health:   number = 100;
    armor:    number = 50;

    @ignore
    serverOnlyFlag: boolean = false;
}
```

---

## Components on the client side

`@sync` registers the component constructor in `globalThis.__entm` on the **server** side only. When the client's `SyncSystem` receives a sync payload, it looks up the component constructor by name from the client's own `globalThis.__entm`. If the constructor isn't there, the sync is silently dropped.

To receive synced data on the client, define a matching component decorated with `@shared` in your client code:

```ts
// server/components/Health.ts
import { Component, sync } from "@ratprez/entm";

@sync('full')
export class Health extends Component {
    current: number = 100;
    max:     number = 100;
}
```

```ts
// client/components/Health.ts
import { Component, shared } from "@ratprez/entm";

@shared
export class Health extends Component {
    current: number = 0;
    max:     number = 0;
}
```

The server component uses `@sync` to mark it for replication. The client component uses `@shared` to register its constructor in the client's global registry, so `SyncSystem` can find and populate it when data arrives.

`@shared` is **side-scoped** — it only registers in the global registry of the side it runs on. A `@shared` component in a server script is invisible to client scripts and vice versa. There is no automatic cross-side sharing.

---

## NetEntity component

`NetEntity` is the built-in component that ties an ECS entity to a network ID. It's added automatically to synced entities by the server `SyncSystem`. You generally don't add it manually.

```ts
class NetEntity extends Component {
    readonly netId: number;

    constructor(netId: number) { ... }
}
```

The `netId` is the server-side entity ID (the integer returned by `createEntity`). On clients, `SyncSystem` maintains a `Map<netId, localEntityId>` to route incoming events to the right entity.

---

## Network events

These are the internal events used by the sync system. You don't need to handle them manually, but they're useful for debugging:

| Event | Direction | Description |
|---|---|---|
| `entm-core:cl:entity_create` | sv → cl | A new synced entity was created |
| `entm-core:cl:entity_destroy` | sv → cl | A synced entity was destroyed |
| `entm-core:cl:sync` | sv → cl | Field-level sync payload (full sync) |
| `entm-core:cl:sync_life` | sv → cl | Component added to a synced entity |
| `entm-core:cl:sync_remove` | sv → cl | Component removed from a synced entity |

---

## Full example

**Server:**
```ts
import { Component, sync, ignore, World, System } from "@ratprez/entm";

@sync('full')
class Health extends Component {
    current: number = 100;
    max:     number = 100;

    @ignore
    serverTag: string = "sv";
}

class SpawnSystem extends System {
    override onStart(): void {
        onNet("playerSpawned", (source: number) => {
            const id = this.m_world.createEntity(true);
            this.m_world.addComponent(id, new Health());
        });
    }
}

declare function __registerModule(init: (world: World) => void): void;
__registerModule((world) => {
    world.addSystem(new SpawnSystem(world));
});
```

**Client:**
```ts
import { Component, shared, System, World } from "@ratprez/entm";

// Client-side version of Health — @shared registers it so SyncSystem can find it
@shared
class Health extends Component {
    current: number = 0;
    max:     number = 0;
}

class HudSystem extends System {
    override update(dt: number): void {
        for (const { entityId, health } of this.m_world.view(Health)) {
            // render health bar using health.current / health.max
        }
    }
}

declare function __registerModule(init: (world: World) => void): void;
__registerModule((world) => {
    world.addSystem(new HudSystem(world));
});
```

---

*docs written by claude and cleaned up by hand*
