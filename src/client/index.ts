import { World, System, View, ComponentPool, Profiler, PlayerData, Component, Vec3, CPed, CVehicle, shared, sync, ignore, NetEntity, CfxEntity } from "@ratprez/entm";
import { EntitySystem } from "./systems/EntitySystem";
import { DebugSystem }  from "./systems/DebugSystem";
import { SyncSystem }   from "./systems/SyncSystem";
import { ModuleLoader, startLoop } from "shared/ModuleLoader";

const g_world = new World();

// expose entm-base classes for loaded modules
(globalThis as any).__entm = {
    // core
    World, System, View, ComponentPool, Component, Profiler,
    // decorators
    shared, sync, ignore,
    // components - common
    Vec3, PlayerData, NetEntity, CfxEntity,
    // components - client
    CPed, CVehicle,
};

const g_loader = new ModuleLoader(g_world, "client");

on("onResourceStop", (name: string) => g_loader.unload(name));

function registerMainSystems() {
    if (GetConvar("sv_debug", "false") === "true") {
        const profiler = new Profiler();
        g_world.setProfiler(profiler);
        g_world.addSystem(new DebugSystem(g_world, profiler));
    }

    g_world.addSystem(new SyncSystem(g_world));
    g_world.addSystem(new EntitySystem(g_world));
}

// --- exports ---

exports("registerModule", (resourceName: string) => g_loader.load(resourceName, "dist/client.js"));


// --- main ---

{
    registerMainSystems();
    startLoop(g_world);
}
