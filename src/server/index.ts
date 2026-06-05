import { World, System, View, ComponentPool, Component, Profiler, Vec3, SPed, SVehicle, shared, sync, ignore, PlayerData, NetEntity, CfxEntity } from "@ratprez/entm";
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
    // components - server
    SPed, SVehicle,
};

const g_loader = new ModuleLoader(g_world, "server");

on("onResourceStop", (name: string) => g_loader.unload(name));

function registerMainSystems() {
    g_world.addSystem(new SyncSystem(g_world));
}

// --- exports ---

exports("registerModule", (resourceName: string) => g_loader.load(resourceName, "dist/server.js"));


// --- main ---

{
    registerMainSystems();
    startLoop(g_world);
}
