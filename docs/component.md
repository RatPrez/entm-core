# Component

Components are plain data containers attached to entities. They hold state — no logic, no behaviour. All component classes extend the base `Component` class from `@ratprez/entm`.

> **Package:** [`@ratprez/entm`](https://github.com/RatPrez/entm)

---

## Base class

```ts
import { Component } from "@ratprez/entm";

export abstract class Component {
    get sType(): string {
        return toCamelCase(this.constructor.name);
    }
}
```

The `sType` getter returns the component's class name with the first letter lowercased — e.g. `Health` becomes `"health"`, `CfxEntity` becomes `"cfxEntity"`. This string is the component's identity inside the framework. It's derived automatically from the class name, so you never set it manually.

> `sType` is what allows components to cross FiveM resource boundaries. Because FiveM serializes arguments between exports, class instances lose their prototype. `sType` is a plain string that survives that boundary and lets the framework reconstruct the correct pool on the other side.

---

## Creating a component

Extend `Component` and define your fields. Use the constructor to set initial values.

```ts
import { Component } from "@ratprez/entm";

export class Health extends Component {
    current: number;
    max:     number;

    constructor(max: number) {
        super();
        this.current = max;
        this.max     = max;
    }
}
```

That's a complete component. To attach it to an entity:

```ts
const id = world.createEntity();
world.addComponent(id, new Health(100));
```

---

## Decorators

### `@shared`

Registers the component class in `globalThis.__entm` so other loaded modules can access it by name without importing your code directly.

```ts
import { Component, shared } from "@ratprez/entm";

@shared
export class Health extends Component {
    current: number;
    max:     number;

    constructor(max: number) {
        super();
        this.current = max;
        this.max     = max;
    }
}
```

Without `@shared`, other modules cannot reference your component class at runtime, even if they import the types for TypeScript. You need `@shared` on any component that:

- Is accessed from a different module.
- Uses `@sync` (network sync requires the class to be in the global registry).

### Cross-module forward declarations

TypeScript doesn't know about another module's exported classes at compile time. When you consume a `@shared` component from a different resource, add a forward declaration in your module:

```ts
// Forward declaration so TypeScript is happy
// The real class is injected at runtime from module-a
declare class Health {
    current: number;
    max:     number;
}
```

The runtime instance comes from `globalThis.__entm["health"]`; the declaration just satisfies the type checker.

---

### `@sync`

Marks a component for automatic network synchronization between server and clients. Requires `@shared` as well. Takes a mode: `'full'` or `'life'`.

```ts
import { Component, shared, sync } from "@ratprez/entm";

@shared
@sync('full')
export class Position extends Component {
    x: number = 0;
    y: number = 0;
    z: number = 0;
}
```

**`@sync('full')`** — field-level sync. The component is wrapped in a `Proxy` on the server. Every time a field is mutated, the change is queued for broadcast to all clients on the next fixed tick (30 Hz). Use this for components whose fields update regularly.

**`@sync('life')`** — presence sync only. The component is broadcast to clients when it's added to or removed from an entity. The field values are not continuously synced — only the existence of the component matters. Use this for state flags or components that change infrequently.

> Sync only works on **server-side** entities. The entity must also have a `NetEntity` component (i.e. created with `world.createEntity(true)` or via the sync system).

---

### `@ignore`

Prevents a specific field from being included in sync payloads. Use it on fields that are server-side only or don't need to be replicated.

```ts
import { Component, shared, sync, ignore } from "@ratprez/entm";

@shared
@sync('full')
export class PlayerData extends Component {
    health:   number = 100;
    armor:    number = 0;

    @ignore
    internalFlag: boolean = false;
}
```

`internalFlag` will never be sent to clients, even though the component is `@sync('full')`.

---

## Type reference

```ts
abstract class Component {
    get sType(): string;
}

function shared<T extends abstract new (...args: any[]) => Component>(
    target: T,
    context: ClassDecoratorContext<T>
): void;

function sync(mode: 'full' | 'life'): (
    target: T,
    context: ClassDecoratorContext<T>
) => void;

function ignore(
    _target: any,
    context: ClassFieldDecoratorContext
): void;
```

---

*docs written by claude and cleaned up by hand*
