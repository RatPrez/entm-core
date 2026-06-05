import { World, System, View, ComponentPool, Component, Profiler, Vec3, SPed, SVehicle, shared, sync, ignore } from "@ratprez/entm";
import { SyncSystem } from "./systems/SyncSystem";

const k_fixedTimestep = 1.0 / 30.0;
const k_maxDelta      = 0.25;
const g_world         = new World();

// expose entm-base classes for loaded modules
(globalThis as any).__entm = {
    World, System, View, ComponentPool, Profiler, Component,
    Vec3, SPed, SVehicle, shared, sync, ignore
};

// --- module registry ---

type ModuleRecord = {
    systems:  (new (...args: any[]) => System)[];
    entities: number[];
};

const g_modules = new Map<string, ModuleRecord>();

on("onResourceStop", (name: string) => {
    const record = g_modules.get(name);
    if (!record) return;

    for (const id  of record.entities)  g_world.destroyEntity(id); // destroy entities first so systems can do proper cleanup as it's still an internalized script
    for (const ctor of record.systems)  g_world.removeSystem(ctor);

    g_modules.delete(name);
    console.log(`[entm-core] unloaded server module: ${name}`);
});

// --- module loader ---

type RetryEntry = { resourceName: string; code: string };

const g_retryQueue: RetryEntry[] = [];

function tryLoadModule(resourceName: string, code: string): boolean {
    try {
        let initFn: ((world: World) => void) | null = null;
        (globalThis as any).__registerModule = (fn: (world: World) => void) => { initFn = fn; };
        new Function(code)();
        delete (globalThis as any).__registerModule;

        if (initFn) {
            const record: ModuleRecord = { systems: [], entities: [] };

            const origAddSystem    = g_world.addSystem.bind(g_world);
            const origCreateEntity = g_world.createEntity.bind(g_world);

            (g_world as any).addSystem    = (s: System) => { record.systems.push(s.constructor as any); origAddSystem(s); };
            (g_world as any).createEntity = (...args: any[]) => { const id = origCreateEntity(...args); record.entities.push(id); return id; };

            (initFn as Function)(g_world);

            (g_world as any).addSystem    = origAddSystem;
            (g_world as any).createEntity = origCreateEntity;

            g_modules.set(resourceName, record);
        }

        console.log(`[entm-core] loaded server module: ${resourceName}`);
        return true;
    } catch (e) {
        if (e instanceof ReferenceError || e instanceof TypeError) {
            console.warn(`[entm-core] server module ${resourceName} queued — missing dependency: ${e}`);
        } else {
            console.error(`[entm-core] error in server module ${resourceName}: ${e}`);
        }
        return false;
    }
}

function drainQueue(): void {
    let madeProgress: boolean;
    do {
        madeProgress = false;
        const pending = [...g_retryQueue];
        g_retryQueue.length = 0;

        for (const entry of pending) {
            if (tryLoadModule(entry.resourceName, entry.code)) {
                madeProgress = true;
            } else {
                g_retryQueue.push(entry);
            }
        }
    } while (madeProgress && g_retryQueue.length > 0);
}

function loadModule(resourceName: string): void {
    const code = LoadResourceFile(resourceName, "dist/server.js");
    if (!code) {
        console.error(`[entm-core] failed to load server module from ${resourceName}`);
        return;
    }

    if (tryLoadModule(resourceName, code)) {
        drainQueue();
    } else {
        g_retryQueue.push({ resourceName, code });
    }
}

function registerMainSystems() {
    g_world.addSystem(new SyncSystem(g_world));
}

// --- exports ---

exports("registerModule", (resourceName: string) => loadModule(resourceName));


// --- main ---

{
    registerMainSystems();

    let lastTime  = GetGameTimer();
    let fixedAccumulator = 0.0;

    setTick(() => {
        const now     = GetGameTimer();
        let deltaTime = (now - lastTime) / 1000.0;
        lastTime      = now;

        deltaTime         = Math.min(deltaTime, k_maxDelta);
        fixedAccumulator += deltaTime;

        while (fixedAccumulator >= k_fixedTimestep) {
            g_world.updateFixed(k_fixedTimestep);
            fixedAccumulator -= k_fixedTimestep;
        }

        g_world.update(deltaTime);
    });
}
