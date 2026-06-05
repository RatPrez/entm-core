# entm-core

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/ratprez)

An Entity Component System (ECS) framework resource for FiveM, written in TypeScript.

I originally started writing an ECS in C++, data-oriented, cache-friendly, the whole thing. At some point I thought: *I wonder if I could make this work in FiveM.* Turns out it can.... kinda. So here it is.

> Updates will come when I feel like it or when someone asks nicely enough. No promises.

---

## What is an ECS?

ECS is an architectural pattern common in game engines. Instead of objects that own their behaviour, you have:

- **Entities** — just an ID
- **Components** — plain data attached to entities
- **Systems** — logic that runs over entities matching a set of components

The result is clean separation of data and behaviour, and fast iteration since matching components live in contiguous memory.

---

## Features

- **Class-based components** with constructor-based type indexing — no strings, no generics at call sites
- **Type-safe views** — `world.view(Ped, CfxEntity)` infers the result shape automatically
- **Module loader** — load external FiveM resources as entm modules directly into the world's context, bypassing FiveM's serialization boundary entirely
- **Shared components** — mark a component `@shared` and it becomes available to all loaded modules
- **Automatic sync** — `@sync('full')` and `@sync('life')` decorators replicate component state from server to clients automatically
- **Automatic cleanup** — when a module resource stops, its systems and entities are removed from the world
- **Retry queue** — modules that fail due to missing shared components are automatically retried when later modules load successfully
- **Fixed + variable timestep** — fixed update at 30 Hz (matched to FiveM's network tick rate), variable update every frame

---

## Performance

The ECS was stress tested to validate that the framework overhead stays out of your way. With thousands of entities and multiple systems running, the loop itself stays well under a millisecond. The real cost will always come from FiveM native calls inside your systems, not from entm-core.

---

## Docs

Full documentation is in the [`docs/`](./docs/) folder:

| Doc | Description |
|---|---|
| [Getting Started](./docs/getting-started.md) | Installation, module setup, entry points, how the loader works |
| [Component](./docs/component.md) | Component base class, decorators (`@shared`, `@sync`, `@ignore`) |
| [System](./docs/system.md) | System base class and all overridable callbacks |
| [World](./docs/world.md) | Entity, component, and system management; views |
| [Network](./docs/network.md) | Server → client sync, `@sync('full')`, `@sync('life')` |
| [Default Components](./docs/default-components.md) | Built-in components (`Transform`, `CfxEntity`, `CPed`, `SVehicle`, etc.) |

---

## Quick start

1. Drop `entm-core` into your `resources` directory.
2. Add `ensure entm-core` to `server.cfg` (before any modules that depend on it).
3. Use the [entm-template](https://github.com/RatPrez/entm-template) to create your first module.

```bash
npm install @ratprez/entm
```

[`@ratprez/entm` on npm](https://www.npmjs.com/package/@ratprez/entm) · [entm-template →](https://github.com/RatPrez/entm-template)

---

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/ratprez)
