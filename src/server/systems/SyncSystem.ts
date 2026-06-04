import { NetEntity, System, EntityId, compareClass, toCamelCase } from "@ratprez/entm";
import { Logger } from "shared/Logger";

const logger = new Logger("SyncSystem");
const THRESHOLD = 1024;

export class SyncSystem extends System {
// public
    override onStart(): void {
        logger.log('started');
    }

    override onNetEntityCreated(id: EntityId): void {
        logger.log(`onNetEntityCreated | entity: ${id}`);
        const netEntity = this.m_world.getComponent(id, NetEntity);
        if (netEntity) {
            logger.warn(`onNetEntityCreated | NetEntity already exists on entity ${id} (netId: ${netEntity.netId})`);
            return;
        }
        this.m_world.addComponent(id, new NetEntity(id));
        logger.log(`onNetEntityCreated | added NetEntity, broadcasting entity_create to all clients`);
        TriggerClientEvent("entm-core:cl:entity_create", -1, id);
    }

    override onNetEntityDestroyed(id: EntityId): void {
        const netEntity = this.m_world.getComponent(id, NetEntity);
        logger.log(`onNetEntityDestroyed | entity: ${id}, netId: ${netEntity?.netId ?? 'unknown'}, broadcasting entity_destroy`);
        TriggerClientEvent("entm-core:cl:entity_destroy", -1, id);
    }

    override onComponentAdded(id: EntityId, sType: string): void {
        logger.log(`onComponentAdded | entity: ${id}, sType: ${sType}`);

        if (compareClass(sType, "netEntity")) {
            logger.log(`onComponentAdded | netEntity should not be synced, skipping`);
            return;
        }

        const ctor = (globalThis as any).__entm[sType];
        if (!ctor) {
            logger.log(`onComponentAdded | ${sType} not in global registry, skipping`);
            return;
        }
        if (ctor.sync !== 'life' && ctor.sync !== 'full') {
            logger.log(`onComponentAdded | ${sType} sync mode is '${ctor.sync}', skipping`);
            return;
        }

        const netEntity = this.m_world.getComponent(id, NetEntity);
        if (!netEntity) {
            logger.warn(`onComponentAdded | entity ${id} has no NetEntity, cannot sync ${sType}`);
            return;
        }

        logger.log(`onComponentAdded | broadcasting sync_life: ${sType} on entity ${id} (netId: ${netEntity.netId})`);
        TriggerClientEvent("entm-core:cl:sync_life", -1, netEntity.netId, sType);
    }

    override onComponentRemoved(id: EntityId, sType: string): void {
        logger.log(`onComponentRemoved | entity: ${id}, sType: ${sType}`);
        const ctor = (globalThis as any).__entm[sType];
        if (!ctor || !ctor.sync) {
            logger.log(`onComponentRemoved | ${sType} has no sync mode, skipping`);
            return;
        }
        const netEntity = this.m_world.getComponent(id, NetEntity);
        if (!netEntity) {
            logger.warn(`onComponentRemoved | entity ${id} has no NetEntity, cannot sync removal of ${sType}`);
            return;
        }
        logger.log(`onComponentRemoved | broadcasting sync_remove: ${sType} on entity ${id} (netId: ${netEntity.netId})`);
        TriggerClientEvent("entm-core:cl:sync_remove", -1, netEntity.netId, sType);
    }

    override updateFixed(fixedTime: number): void {
        const queue = this.m_world.syncQueue.flush();
        if (queue.length === 0) return;

        const payload = this.buildPayload(queue);
        const json = JSON.stringify(payload);

        logger.log(`updateFixed | ${queue.length} component(s), ${Object.keys(payload).length} entity(s), ${json.length} bytes | ${json}`);

        if (json.length > THRESHOLD) {
            logger.warn(`updateFixed | payload exceeded threshold (${json.length} > ${THRESHOLD} bytes), using latent event`);
            TriggerLatentClientEvent("entm-core:cl:sync", -1, 25000, payload);
        } else {
            TriggerClientEvent("entm-core:cl:sync", -1, payload);
        }
    }

// private
    private buildPayload(queue: any): any {
        const payload: Record<number, Record<string, Record<string, any>>> = {};
        for (const { entityId, component } of queue) {
            const netEntity = this.m_world.getComponent(entityId, NetEntity);
            if (!netEntity) continue;

            const ctor = component.constructor as any;
            const name = toCamelCase(component.constructor.name);
            payload[netEntity.netId] ??= {};
            payload[netEntity.netId][name] ??= {};

            for (const key of Object.keys(component)) {
                if (ctor.__ignoreFields?.has(key)) continue;
                payload[netEntity.netId][name][key] = (component as any)[key];
            }
        }
        return payload;
    }
}
