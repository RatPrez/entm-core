import { World, System, View, ComponentPool, Component, Profiler, Vec3, SPed, SVehicle, shared, sync, ignore, PlayerData, NetEntity, CfxEntity, Logger } from "@ratprez/entm";
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
    // util
    Logger,
};

// --- debug ---

let g_debug = false;

RegisterCommand("entm_debug", (_source: number, args: string[]) => {
    g_debug = args[0] === "1" || args[0] === "true";
    emit("__int_entm::debug_toggle", g_debug);
    TriggerClientEvent("__int_entm::cl_debug_toggle", -1, g_debug);
    console.log(`[entm-core] debug ${g_debug ? "enabled" : "disabled"}`);
}, true);

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
