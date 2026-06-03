import { World, System, View, ComponentPool, Profiler,
         vec3, vec3Add, vec3Sub, vec3Scale, vec3Len,
         Ped, Vehicle, shared } from "@ratprez/entm";

import { EntitySystem } from "./systems/fivem/EntitySystem";
import { DebugSystem }  from "./systems/DebugSystem";

const Delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

const k_fixedTimestep = 1.0 / 30.0;
const k_maxDelta      = 0.25;
const g_world         = new World();

// expose entm-base classes for loaded modules
(globalThis as any).__entm = {
    World, System, View, ComponentPool, Profiler,
    vec3, vec3Add, vec3Sub, vec3Scale, vec3Len,
    Ped, Vehicle, shared,
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

    for (const ctor of record.systems)  g_world.removeSystem(ctor);
    for (const id  of record.entities)  g_world.destroyEntity(id);

    g_modules.delete(name);
    console.log(`[entm-core] unloaded client module: ${name}`);
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
            (g_world as any).createEntity = () => { const id = origCreateEntity(); record.entities.push(id); return id; };

            (initFn as Function)(g_world);

            (g_world as any).addSystem    = origAddSystem;
            (g_world as any).createEntity = origCreateEntity;

            g_modules.set(resourceName, record);
        }

        console.log(`[entm-core] loaded client module: ${resourceName}`);
        return true;
    } catch (e) {
        if (e instanceof ReferenceError || e instanceof TypeError) {
            console.warn(`[entm-core] client module ${resourceName} queued — missing dependency: ${e}`);
        } else {
            console.error(`[entm-core] error in client module ${resourceName}: ${e}`);
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
    const code = LoadResourceFile(resourceName, "dist/client.js");
    if (!code) {
        console.error(`[entm-core] failed to load client module from ${resourceName}`);
        return;
    }

    if (tryLoadModule(resourceName, code)) {
        drainQueue();
    } else {
        g_retryQueue.push({ resourceName, code });
    }
}

// --- main ---

async function gameLoop(): Promise<void> {
    let lastTime         = GetGameTimer();
    let fixedAccumulator = 0.0;

    if (GetConvar("sv_debug", "false") === "true") {
        const profiler = new Profiler();
        g_world.setProfiler(profiler);
        g_world.addSystem(new DebugSystem(g_world, profiler));
    }

    g_world.addSystem(new EntitySystem(g_world));

    while (true) {
        const now     = GetGameTimer();
        let deltaTime = (now - lastTime) / 1000.0;
        lastTime      = now;

        deltaTime        = Math.min(deltaTime, k_maxDelta);
        fixedAccumulator += deltaTime;

        while (fixedAccumulator >= k_fixedTimestep) {
            g_world.updateFixed(k_fixedTimestep);
            fixedAccumulator -= k_fixedTimestep;
        }

        g_world.update(deltaTime);
        await Delay(0);
    }
}

// --- exports ---

exports("registerModule", (resourceName: string) => loadModule(resourceName));

gameLoop();
