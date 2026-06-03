# entm-core

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/ratprez)

An Entity Component System (ECS) framework resource for FiveM, written in TypeScript.

I originally started writing an ECS in C++, data-oriented, cache-friendly, the whole thing. At some point I thought: *I wonder if I could make this work in FiveM.* Turns out it can.... kinda. So here it is.

> Updates will come when I feel like it or when someone asks nicely enough. No promises.

---

## What is an ECS?

ECS is an architectural pattern common in game engines. Instead of objects that own their behaviour, you have:

- **Entities** - just an ID
- **Components** - plain data attached to entities
- **Systems** - logic that runs over entities matching a set of components

The result is clean separation of data and behaviour, and fast iteration since matching components live in contiguous memory.

---

## Features

- **Class-based components** with constructor-based type indexing - no strings, no generics at call sites
- **Type-safe views** - `world.view(Ped, CfxEntity)` infers the result shape automatically
- **Module loader** - load external FiveM resources as entm modules directly into the world's context, bypassing FiveM's serialization boundary entirely
- **Shared components** - mark a component `@shared` and it becomes available to all loaded modules
- **Automatic cleanup** - when a module resource stops, its systems and entities are removed from the world
- **Retry queue** - modules that fail due to missing shared components are automatically retried when later modules load successfully
- **Fixed + variable timestep** - fixed update at 30Hz (matched to FiveM's network tick rate), variable update every frame

---

## Performance

| Metric | Result |
|---|---|
| Idle loop cost | ~0.07ms per frame |
| Stress test | 5,000 entities, no measurable impact |
| Fixed timestep | 30Hz (aligned to FiveM network tick) |

The ECS loop itself is negligible. Real cost comes from FiveM native calls inside your systems, not the framework.

---

## Potential Future Updates

- **More Built-in Comps** - just making some more base components
- **Automatic Net Sync** - @sync decorator on server components to automatically replicate the data onto all clients

---

## Getting Started

### 1. Download entm-core

Grab the latest release and drop the `entm-core` folder into your server's `resources` directory.

### 2. Add to server.cfg

```
ensure entm-core
```

Make sure `entm-core` starts **before** any modules that depend on it.

### 3. Create a module

Use the [entm-template](https://github.com/RatPrez/entm-template) as your starting point - it's pre-configured with the correct build setup, the `@ratprez/entm` package, and the loader script that registers itself with entm-core automatically.

---

## Writing a Module

Install the base package in your module project:

```bash
npm install @ratprez/entm
```

### Defining a component

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

`@shared` registers the class inside `entm-core` so other modules can access it without importing your code directly, you will still need to provide a forward declaration in any other modules that use it, in order to make typescript happy.

### Defining a system

```ts
import { System } from "@ratprez/entm";
import type { World } from "@ratprez/entm";
import { Health } from "./components/Health";

class HealthSystem extends System {
    override update(dt: number): void {
        for (const { health } of this.m_world.view(Health)) {
            if (health.current <= 0) {
                // handle death
            }
        }
    }
}
```

### Registering the module

```ts
declare function __registerModule(init: (world: World) => void): void;

__registerModule((world) => {
    world.addSystem(new HealthSystem(world));
});
```

### fxmanifest.lua

```lua
fx_version 'cerulean'
game 'gta5'

dependency 'entm-core'

client_scripts { 'loader/client.js' }
server_scripts { 'loader/server.js' }

files {
    'dist/client.js',
    'dist/server.js',
}
```

---

## Base Package

The TypeScript types and core classes are published separately as an npm package:

```bash
npm install @ratprez/entm
```

[`@ratprez/entm` on npm](https://www.npmjs.com/package/@ratprez/entm)

---

## Template

Don't start from scratch - the template has everything wired up:

[entm-template →](https://github.com/RatPrez/entm-template)

---

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/ratprez)
