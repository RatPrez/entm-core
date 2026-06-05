import { EntityId, NetEntity, System, compareClass } from "@ratprez/entm";
import { Logger } from "shared/Logger";

const logger = new Logger("SyncSystem");

export class SyncSystem extends System {
// public
    override onStart(): void {
        onNet("entm-core:cl:entity_create",       (netId: number)                                                         => this.handleEntityCreate(netId));
        onNet("entm-core:cl:entity_create_batch", (netIds: number[])                                                      => netIds.forEach(id => this.handleEntityCreate(id)));
        onNet("entm-core:cl:entity_destroy",      (netId: number)                                                         => this.handleEntityDestroy(netId));
        onNet("entm-core:cl:sync",                (payload: Record<number, Record<string, Record<string, any>>>)          => this.handleSync(payload));
        onNet("entm-core:cl:sync_remove",         (netId: number, componentName: string)                                  => this.handleSyncRemove(netId, componentName));
        onNet("entm-core:cl:sync_life",           (netId: number, componentName: string)                                  => this.handleLifeSync(netId, componentName));
        onNet("entm-core:cl:sync_life_batch",     (payload: Record<number, string[]>)                                     => this.handleLifeSyncBatch(payload));

        logger.log('started');
    }

    override onComponentAdded(id: EntityId, sType: string): void {
        logger.log(`onComponentAdded | entity: ${id}, sType: ${sType}`);
        if (!compareClass(sType, 'netEntity')) return;
        const netEntity = this.m_world.getComponent(id, NetEntity);
        if (!netEntity) {
            logger.warn(`onComponentAdded | netEntity component missing on entity ${id}`);
            return;
        }
        this.m_netIdMap.set(netEntity.netId, id);
        logger.log(`onComponentAdded | mapped netId ${netEntity.netId} -> entity ${id}`);
    }

    override onComponentRemoved(id: EntityId, sType: string): void {
        logger.log(`onComponentRemoved | entity: ${id}, sType: ${sType}`);
        if (!compareClass(sType, 'netEntity')) return;
        const netEntity = this.m_world.getComponent(id, NetEntity);
        if (!netEntity) {
            logger.warn(`onComponentRemoved | netEntity component missing on entity ${id}`);
            return;
        }
        this.m_netIdMap.delete(netEntity.netId);
        logger.log(`onComponentRemoved | unmapped netId ${netEntity.netId}`);
    }

// private
    private handleSync(payload: Record<number, Record<string, Record<string, any>>>): void {
        logger.log(`handleSync | received payload for ${Object.keys(payload).length} entity(s)`);
        for (const [netIdStr, components] of Object.entries(payload)) {
            const netId = Number(netIdStr);
            const entityId = this.m_netIdMap.get(netId);
            if (!entityId) {
                logger.warn(`handleSync | unknown netId ${netId}, skipping`);
                continue;
            }

            for (const [componentName, fields] of Object.entries(components)) {
                const ctor = (globalThis as any).__entm[componentName];
                if (!ctor) {
                    logger.warn(`handleSync | unknown component ${componentName} on entity ${entityId} (netId: ${netId})`);
                    continue;
                }

                let component = this.m_world.getComponent(entityId, ctor);
                if (!component) {
                    logger.log(`handleSync | ${componentName} not found on entity ${entityId}, adding it`);
                    component = this.m_world.addComponent(entityId, new ctor());
                }

                for (const [key, value] of Object.entries(fields)) {
                    (component as any)[key] = value;
                }
                logger.log(`handleSync | updated ${componentName} on entity ${entityId} (netId: ${netId}) | fields: ${JSON.stringify(fields)}`);
            }
        }
    }

    private handleLifeSync(netId: number, sType: string): void {
        logger.log(`handleLifeSync | netId: ${netId}, sType: ${sType}`);
        const entityId = this.m_netIdMap.get(netId);
        if (!entityId) {
            logger.warn(`handleLifeSync | unknown netId ${netId}`);
            return;
        }
        const ctor = (globalThis as any).__entm[sType];
        if (!ctor) {
            logger.warn(`handleLifeSync | unknown component ${sType}`);
            return;
        }
        if (!this.m_world.getComponent(entityId, ctor)) {
            this.m_world.addComponent(entityId, new ctor());
            logger.log(`handleLifeSync | added ${sType} to entity ${entityId}`);
        } else {
            logger.log(`handleLifeSync | ${sType} already exists on entity ${entityId}, skipping`);
        }
    }

    private handleSyncRemove(netId: number, sType: string): void {
        logger.log(`handleSyncRemove | netId: ${netId}, sType: ${sType}`);
        const entityId = this.m_netIdMap.get(netId);
        if (!entityId) {
            logger.warn(`handleSyncRemove | unknown netId ${netId}`);
            return;
        }
        const ctor = (globalThis as any).__entm[sType];
        if (!ctor) {
            logger.warn(`handleSyncRemove | unknown component ${sType}`);
            return;
        }
        this.m_world.removeComponent(entityId, ctor);
        logger.log(`handleSyncRemove | removed ${sType} from entity ${entityId}`);
    }

    private handleLifeSyncBatch(payload: Record<number, string[]>): void {
        logger.log(`handleLifeSyncBatch | ${Object.keys(payload).length} entity(s)`);
        for (const [netIdStr, sTypes] of Object.entries(payload)) {
            const netId = Number(netIdStr);
            for (const sType of sTypes) {
                this.handleLifeSync(netId, sType);
            }
        }
    }

    private handleEntityCreate(netId: number): void {
        if (this.m_netIdMap.has(netId)) {
            logger.log(`handleEntityCreate | netId ${netId} already exists, skipping`);
            return;
        }
        logger.log(`handleEntityCreate | netId: ${netId}`);
        const entityId = this.m_world.createEntity();
        this.m_world.addComponent(entityId, new NetEntity(netId));
        logger.log(`handleEntityCreate | created entity ${entityId} for netId ${netId}, mapped in netIdMap`);
    }

    private handleEntityDestroy(netId: number): void {
        logger.log(`handleEntityDestroy | netId: ${netId}`);
        const entityId = this.m_netIdMap.get(netId);
        if (!entityId) {
            logger.warn(`handleEntityDestroy | unknown netId ${netId}`);
            return;
        }
        this.m_world.destroyEntity(entityId);
        logger.log(`handleEntityDestroy | destroyed entity ${entityId} (netId: ${netId})`);
    }

    private m_netIdMap: Map<number, number> = new Map();
}
