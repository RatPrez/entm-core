# Component

Components are plain data containers attached to entities. They hold state — **no logic, no functions**. All component classes extend the base `Component` class from `@ratprez/entm`.

> The reason components are classes rather than interfaces is that the framework needs a real constructor function at runtime to key component pools and create instances. TypeScript interfaces are erased at compile time and can't serve that role.

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

Extend `Component` and define your fields as class field declarations with default values. Do not add methods — components are pure data.

```ts
import { Component } from "@ratprez/entm";

export class Health extends Component {
    current: number = 100;
    max:     number = 100;
}
```

To attach it to an entity:

```ts
const id = world.createEntity();
world.addComponent(id, new Health());
```

If you need to initialize a component with specific values, set them after construction:

```ts
const hp = world.addComponent(id, new Health());
hp.current = 50;
hp.max     = 150;
```

---

## `import type` vs `import`

When you only reference a class as a **type annotation** — and never call `new` or access static members — always use `import type`:

```ts
// Good — type-only reference, erased at compile time
import type { World } from "@ratprez/entm";

// Bad — emits a runtime import even though World is only used as a type
import { World } from "@ratprez/entm";
```

Without `import type`, TypeScript may emit the class into the bundle even when it's not needed. Since modules are evaluated inside entm-core's context (via `new Function(code)()`), an unnecessary runtime import can result in a second version of the class being instantiated. The framework identifies component pools by constructor reference — two different constructor functions for the same class name will produce two separate pools and the framework will get confused. `import type` guarantees the import is erased before the bundle is evaluated.

---

## Decorators

### `@shared`

Registers the component class in `globalThis.__entm` under its `sType` name. This allows other loaded modules to access the constructor by name at runtime, without needing to import your code directly.

```ts
import { Component, shared } from "@ratprez/entm";

@shared
export class Health extends Component {
    current: number = 100;
    max:     number = 100;
}
```

`@shared` is **side-scoped** — a `@shared` class on the server is only registered in the server's global registry. Client scripts do not see it, and vice versa. If you need a component to be accessible on both sides, define and decorate it on both sides.

`@shared` does not affect sync behaviour on its own. It just makes the constructor available by name to other modules. See [Network](./network.md) for how sync uses the registry.

### Cross-module access

When another module needs to work with a `@shared` component from your module, they can't import your source directly (different resources). Instead, use a forward declaration to satisfy TypeScript, and rely on the runtime registration for the actual constructor:

```ts
// Forward declaration — TypeScript is happy, runtime value comes from globalThis.__entm
declare class Health {
    current: number;
    max:     number;
}
```

The real class is already registered in the global registry by the time your module runs (assuming load order is correct or the retry queue resolves it).

---

### `@sync`

Marks a component for automatic server-to-client network synchronization. See [Network](./network.md) for full details on both modes (`'full'` and `'life'`), how the sync pipeline works, and current known limitations.

```ts
import { Component, sync } from "@ratprez/entm";

@sync('full')
export class Position extends Component {
    x: number = 0;
    y: number = 0;
    z: number = 0;
}
```

---

### `@ignore`

Excludes a specific field from sync payloads. Only relevant when the component uses `@sync('full')`. See [Network](./network.md) for usage.

```ts
import { Component, sync, ignore } from "@ratprez/entm";

@sync('full')
export class PlayerState extends Component {
    health: number = 100;

    @ignore
    serverOnlyFlag: boolean = false;
}
```

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
