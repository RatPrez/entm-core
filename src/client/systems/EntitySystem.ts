import { type EntityId, System, CfxEntity, CPed, CVehicle } from "@ratprez/entm";
import { Logger } from "shared/Logger";

const Delay  = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
const logger = new Logger("EntitySystem");

// cfx entity types
enum eEntType {
    NONE = 0,
    PED = 1,
    VEHICLE = 2,
    OBJECT = 3
};

export class EntitySystem extends System {
// public
    override onStart(): void {
        logger.log("started");
    }

    override onEnd(): void {
        logger.log("ended");
        for (const { entityId, cfxEntity } of this.m_world.view(CfxEntity)) {
            this.despawn(entityId, cfxEntity.handle);
        }
    }

    override onEntityDestroyed(id: EntityId): void {
        const cfx = this.m_world.getComponent(id, CfxEntity);
        if (!cfx) return;

        if (DoesEntityExist(cfx.handle)) {
            DeleteEntity(cfx.handle);
            logger.log(`entity ${id} destroyed, deleted cfx handle ${cfx.handle}`);
        }
    }

    override onComponentRemoved(id: EntityId, sType: string): void {
        if (sType === "Ped" || sType === "Vehicle") {
            const cfx = this.m_world.getComponent(id, CfxEntity);
            if (!cfx) return;
            this.despawn(id, cfx.handle);
        }
    }

    override updateFixed(fixedTime: number): void {
        for (const { entityId, ped } of this.m_world.view(CPed)) {
            const cfx = this.m_world.getComponent(entityId, CfxEntity);

            if (this.m_pendingSpawns.has(entityId)) continue;

            if (!cfx) { this.spawnPed(entityId, ped); continue; }

            if (!DoesEntityExist(cfx.handle)) {
                logger.error(`ped entity ${entityId} has invalid handle ${cfx.handle}, respawning`);
                this.despawn(entityId, cfx.handle);
                this.spawnPed(entityId, ped);
                continue;
            }

            if (cfx.model !== ped.model) {
                logger.log(`ped entity ${entityId} model changed, respawning`);
                this.despawn(entityId, cfx.handle);
                this.spawnPed(entityId, ped);
            }
        }

        for (const { entityId, vehicle } of this.m_world.view(CVehicle)) {
            const cfx = this.m_world.getComponent(entityId, CfxEntity);

            if (this.m_pendingSpawns.has(entityId)) continue;

            if (!cfx) { this.spawnVehicle(entityId, vehicle); continue; }

            if (!DoesEntityExist(cfx.handle)) {
                logger.error(`vehicle entity ${entityId} has invalid handle ${cfx.handle}, respawning`);
                this.despawn(entityId, cfx.handle);
                this.spawnVehicle(entityId, vehicle);
                continue;
            }

            if (cfx.model !== vehicle.model) {
                logger.log(`vehicle entity ${entityId} model changed, respawning`);
                this.despawn(entityId, cfx.handle);
                this.spawnVehicle(entityId, vehicle);
            }
        }
    }

// private
    private async spawnPed(id: EntityId, ped: CPed): Promise<void> {
        this.m_pendingSpawns.add(id);
        logger.log(`spawning ped entity ${id} with model ${ped.model}`);

        RequestModel(ped.model);
        while (!HasModelLoaded(ped.model)) await Delay(10);

        const handle = CreatePed(4, ped.model, ped.position.x, ped.position.y, ped.position.z, ped.rotation.y, ped.networked, false);

        if (!DoesEntityExist(handle)) {
            logger.error(`CreatePed failed for entity ${id}`);
            this.m_pendingSpawns.delete(id);
            return;
        }

        this.m_world.addComponent(id, new CfxEntity(handle, ped.model, eEntType.PED, ped.networked ? this.getNetId(handle) : null));
        SetModelAsNoLongerNeeded(ped.model);
        logger.log(`ped entity ${id} spawned with handle ${handle}`);
        this.m_pendingSpawns.delete(id);
    }

    private async spawnVehicle(id: EntityId, vehicle: CVehicle): Promise<void> {
        this.m_pendingSpawns.add(id);
        logger.log(`spawning vehicle entity ${id} with model ${vehicle.model}`);

        RequestModel(vehicle.model);
        while (!HasModelLoaded(vehicle.model)) await Delay(10);

        const handle = CreateVehicle(vehicle.model, vehicle.position.x, vehicle.position.y, vehicle.position.z, vehicle.rotation.y, vehicle.networked, false);

        if (!DoesEntityExist(handle)) {
            logger.error(`CreateVehicle failed for entity ${id}`);
            this.m_pendingSpawns.delete(id);
            return;
        }

        this.m_world.addComponent(id, new CfxEntity(handle, vehicle.model, eEntType.VEHICLE, vehicle.networked ? this.getNetId(handle) : null));
        SetModelAsNoLongerNeeded(vehicle.model);
        logger.log(`vehicle entity ${id} spawned with handle ${handle}`);
        this.m_pendingSpawns.delete(id);
    }

    private despawn(id: EntityId, handle: number): void {
        if (DoesEntityExist(handle)) DeleteEntity(handle);
        this.m_world.removeComponent(id, CfxEntity);
    }

    private getNetId(handle: number): number | null {
        const netId = NetworkGetNetworkIdFromEntity(handle);
        return NetworkDoesNetworkIdExist(netId) ? netId : null;
    }

    private m_pendingSpawns: Set<EntityId> = new Set();
}
