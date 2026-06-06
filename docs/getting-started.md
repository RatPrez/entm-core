# Getting Started

> **Repos**
> - Core resource: [entm-core](https://github.com/RatPrez/entm-core)
> - npm package: [entm (@ratprez/entm)](https://github.com/RatPrez/entm)
> - Template: [entm-template](https://github.com/RatPrez/entm-template)

---

## 1. Install entm-core

Grab the latest release from [entm-core](https://github.com/RatPrez/entm-core) and drop the `entm-core` folder into your server's `resources` directory.

In `server.cfg`, ensure `entm-core` starts **before** any modules that depend on it:

```
ensure entm-core
```

---

## 2. Create a module

The fastest way to start is with the [entm-template](https://github.com/RatPrez/entm-template). It comes pre-wired with the build setup, the `@ratprez/entm` package, and the loader scripts.

If you want to set one up manually, install the npm package:

```bash
npm install @ratprez/entm
```

---

## 3. fxmanifest.lua

Every module needs a `fxmanifest.lua`. The key parts are the `dependency` declaration and the loader scripts:

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

- `dependency 'entm-core'` — tells FiveM this resource requires `entm-core` to be running.
- `loader/client.js` and `loader/server.js` — small scripts that call `entm-core`'s export to load your built bundle.
- `dist/client.js` / `dist/server.js` — your built bundles (compiled by esbuild). These are added to `files` so entm-core can read them.

---

## 4. The loader scripts

The loader scripts are the bridge between your FiveM resource and entm-core. They call the `registerModule` export from entm-core, passing your resource's name.

**loader/client.js**
```js
exports['entm-core'].registerModule(GetCurrentResourceName());
```

**loader/server.js**
```js
exports['entm-core'].registerModule(GetCurrentResourceName());
```

That's it. entm-core reads your built bundle, evaluates it, and wires up your systems and entities.

---

## 5. Entry points

Your entry points (e.g. `src/client/index.ts`, `src/server/index.ts`) are where you register your module with the world. The `__registerModule` global is injected by entm-core at load time.

```ts
import { World } from "@ratprez/entm";
import { MySystem } from "./systems/MySystem";

declare function __registerModule(init: (world: World) => void): void;

__registerModule((world) => {
    world.addSystem(new MySystem(world));
});
```

The callback receives the shared `World` instance. Anything you add — systems, entities, components — is tracked. When your resource stops, it's all automatically cleaned up.

> You need the `declare function __registerModule` line to satisfy TypeScript. The function is injected at runtime by entm-core.

---

## 6. How the loader works

When `registerModule` is called, entm-core does the following:

1. **Reads your bundle** with `LoadResourceFile(resourceName, "dist/client.js")`.
2. **Evaluates it** using `new Function(code)()`. This runs your bundle inside entm-core's context, where `globalThis.__entm` already has all the framework classes available.
3. **Intercepts** `world.addSystem` and `world.createEntity` during your `__registerModule` callback to track everything your module registers.
4. **Stores** a `ModuleRecord` keyed by resource name — lists of system constructors and entity IDs.

On `onResourceStop`:
- All tracked entities are destroyed via `world.destroyEntity`.
- All tracked systems are removed via `world.removeSystem`.
- All component classes the module registered in `globalThis.__entm` via decorators are removed, so a hot-reload re-registers fresh constructors rather than inheriting stale ones.

### Retry queue

If your bundle references a component class from another module that hasn't loaded yet, the evaluation fails with a `ReferenceError`. entm-core catches this and puts your module in a **retry queue**. Every time any module loads successfully, the queue is drained — your module will retry and succeed once its dependency is available.

This is why load order in `server.cfg` matters less than you might expect: as long as all dependencies eventually load, modules resolve themselves.

---

## 7. Build setup

entm-core itself uses esbuild. Your module should use the same approach. The template already has this configured.

The essentials:
- Bundle both `src/client/index.ts` → `dist/client.js` and `src/server/index.ts` → `dist/server.js`.
- Target `es2020`, format `cjs`.
- Client platform is `browser`, server platform is `node`.

```js
// build/bundle.js (example)
const esbuild = require('esbuild');

const shared = {
    bundle:   true,
    target:   'es2020',
    format:   'cjs',
    logLevel: 'info',
};

Promise.all([
    esbuild.build({
        ...shared,
        entryPoints: ['src/client/index.ts'],
        outfile:     'dist/client.js',
        platform:    'browser',
    }),
    esbuild.build({
        ...shared,
        entryPoints: ['src/server/index.ts'],
        outfile:     'dist/server.js',
        platform:    'node',
    }),
]);
```

---

## 8. Debug mode

Run the following command in the server console (or via rcon) to toggle verbose logging across all of entm-core's internal systems on both the server and all connected clients:

```
entm_debug 1   # enable
entm_debug 0   # disable
```

The command is ace-protected and propagates to clients automatically — no restart required.

---

*docs written by claude and cleaned up by hand*
