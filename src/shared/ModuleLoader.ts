import type { World, System } from "@ratprez/entm";

const k_fixedTimestep = 1.0 / 30.0;
const k_maxDelta      = 0.25;

export function startLoop(world: World): void {
    let lastTime         = GetGameTimer();
    let fixedAccumulator = 0.0;

    setTick(() => {
        const now     = GetGameTimer();
        let deltaTime = (now - lastTime) / 1000.0;
        lastTime      = now;

        deltaTime         = Math.min(deltaTime, k_maxDelta);
        fixedAccumulator += deltaTime;

        while (fixedAccumulator >= k_fixedTimestep) {
            world.updateFixed(k_fixedTimestep);
            fixedAccumulator -= k_fixedTimestep;
        }

        world.update(deltaTime);
    });
}

type ModuleRecord = {
    systems:         (new (...args: any[]) => System)[];
    entities:        number[];
    registeredTypes: string[];
};

type RetryEntry = { resourceName: string; code: string };

export class ModuleLoader {
// public
    constructor(world: World, side: string) {
        this.m_world = world;
        this.m_side  = side;
    }

    load(resourceName: string, file: string): void {
        const code = LoadResourceFile(resourceName, file);
        if (!code) {
            console.error(`[entm-core] failed to load ${this.m_side} module from ${resourceName}`);
            return;
        }

        if (this.tryLoad(resourceName, code)) {
            this.drain();
        } else {
            this.m_retryQueue.push({ resourceName, code });
        }
    }

    unload(resourceName: string): void {
        const record = this.m_modules.get(resourceName);
        if (!record) return;

        for (const id   of record.entities)        this.m_world.destroyEntity(id);
        for (const ctor of record.systems)          this.m_world.removeSystem(ctor);
        for (const key  of record.registeredTypes)  delete (globalThis as any).__entm[key];

        this.m_modules.delete(resourceName);
        console.log(`[entm-core] unloaded ${this.m_side} module: ${resourceName}`);
    }

// private
    private tryLoad(resourceName: string, code: string): boolean {
        try {
            // track which __entm keys this module registers via decorators
            const registeredTypes: string[] = [];
            const realEntm = (globalThis as any).__entm;
            (globalThis as any).__entm = new Proxy(realEntm, {
                set(target, key, value) {
                    registeredTypes.push(key as string);
                    target[key as string] = value;
                    return true;
                }
            });

            let initFn: ((world: World) => void) | null = null;
            try {
                (globalThis as any).__registerModule = (fn: (world: World) => void) => { initFn = fn; };
                new Function(code)();
                delete (globalThis as any).__registerModule;
            } finally {
                (globalThis as any).__entm = realEntm;
            }

            if (initFn) {
                const record: ModuleRecord = { systems: [], entities: [], registeredTypes };

                const origAddSystem    = this.m_world.addSystem.bind(this.m_world);
                const origCreateEntity = this.m_world.createEntity.bind(this.m_world);

                try {
                    (this.m_world as any).addSystem    = (s: System) => { record.systems.push(s.constructor as any); origAddSystem(s); };
                    (this.m_world as any).createEntity = (...args: any[]) => { const id = origCreateEntity(...args); record.entities.push(id); return id; };

                    (initFn as Function)(this.m_world);
                } finally {
                    (this.m_world as any).addSystem    = origAddSystem;
                    (this.m_world as any).createEntity = origCreateEntity;
                }

                this.m_modules.set(resourceName, record);
            }

            console.log(`[entm-core] loaded ${this.m_side} module: ${resourceName}`);
            emit("__int_entm::module_loaded");

            return true;
        } catch (e) {
            if (e instanceof ReferenceError || e instanceof TypeError) {
                console.warn(`[entm-core] ${this.m_side} module ${resourceName} queued — missing dependency: ${e}`);
            } else {
                console.error(`[entm-core] error in ${this.m_side} module ${resourceName}: ${e}`);
            }
            return false;
        }
    }

    private drain(): void {
        let madeProgress: boolean;
        do {
            madeProgress = false;
            const pending = [...this.m_retryQueue];
            this.m_retryQueue.length = 0;

            for (const entry of pending) {
                if (this.tryLoad(entry.resourceName, entry.code)) {
                    madeProgress = true;
                } else {
                    this.m_retryQueue.push(entry);
                }
            }
        } while (madeProgress && this.m_retryQueue.length > 0);
    }

    private m_world:      World;
    private m_side:       string;
    private m_modules:    Map<string, ModuleRecord> = new Map();
    private m_retryQueue: RetryEntry[] = [];
}
