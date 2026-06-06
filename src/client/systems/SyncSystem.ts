import { EntityId, NetEntity, System, compareClass, Logger } from "@ratprez/entm";

const logger = new Logger("SyncSystem");

type QueuedOp =
    | { type: 'sync';        componentName: string; fields: Record<string, any> }
    | { type: 'sync_life';   sType: string }
    | { type: 'sync_remove'; sType: string };

export class SyncSystem extends System {
// public
    override onStart(): void {
        onNet("entm-core:cl:entity_create",       (netId: number)                                                => this.handleEntityCreate(netId));
        onNet("entm-core:cl:entity_create_batch", (netIds: number[])                                            => netIds.forEach(id => this.handleEntityCreate(id)));
        onNet("entm-core:cl:entity_destroy",      (netId: number)                                               => this.handleEntityDestroy(netId));
        onNet("entm-core:cl:sync",                (payload: Record<number, Record<string, Record<string, any>>>) => this.handleSync(payload));
        onNet("entm-core:cl:sync_remove",         (netId: number, sType: string)                                => this.handleSyncRemove(netId, sType));
        onNet("entm-core:cl:sync_life",           (netId: number, sType: string)                                => this.handleLifeSync(netId, sType));
        onNet("entm-core:cl:sync_life_batch",     (payload: Record<number, string[]>)                           => this.handleLifeSyncBatch(payload));

        on("__int_entm::module_loaded", () => this.drainAll());

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
        this.drain(netEntity.netId);
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
    private enqueue(netId: number, op: QueuedOp): void {
        let queue = this.m_pendingOps.get(netId);
        if (!queue) {
            queue = [];
            this.m_pendingOps.set(netId, queue);
        }
        queue.push(op);
    }

    private drain(netId: number): void {
        const queue = this.m_pendingOps.get(netId);
        if (!queue) return;

        const entityId = this.m_netIdMap.get(netId);
        if (!entityId) return;

        while (queue.length > 0) {
            const op = queue[0];

            if (op.type === 'sync') {
                const ctor = (globalThis as any).__entm[op.componentName];
                if (!ctor) break;
                const data = { componentName: op.componentName, fields: op.fields };
                queue.shift();
                this.applySync(entityId, netId, data.componentName, data.fields);
            } else if (op.type === 'sync_life') {
                const ctor = (globalThis as any).__entm[op.sType];
                if (!ctor) break;
                const data = { sType: op.sType };
                queue.shift();
                this.applyLifeSync(entityId, data.sType);
            } else if (op.type === 'sync_remove') {
                const ctor = (globalThis as any).__entm[op.sType];
                if (!ctor) break;
                const data = { sType: op.sType };
                queue.shift();
                this.applySyncRemove(entityId, data.sType);
            }
        }

        if (queue.length === 0) this.m_pendingOps.delete(netId);
    }

    private drainAll(): void {
        for (const netId of this.m_pendingOps.keys()) {
            this.drain(netId);
        }
    }

    private applySync(entityId: number, netId: number, componentName: string, fields: Record<string, any>): void {
        const ctor = (globalThis as any).__entm[componentName];
        let component = this.m_world.getComponent(entityId, ctor);
        if (!component) {
            logger.log(`applySync | ${componentName} not found on entity ${entityId}, adding it`);
            component = this.m_world.addComponent(entityId, new ctor());
        }
        for (const [key, value] of Object.entries(fields)) {
            (component as any)[key] = value;
        }
        logger.log(`applySync | updated ${componentName} on entity ${entityId} (netId: ${netId}) | fields: ${JSON.stringify(fields)}`);
    }

    private applyLifeSync(entityId: number, sType: string): void {
        const ctor = (globalThis as any).__entm[sType];
        if (!this.m_world.getComponent(entityId, ctor)) {
            this.m_world.addComponent(entityId, new ctor());
            logger.log(`applyLifeSync | added ${sType} to entity ${entityId}`);
        } else {
            logger.log(`applyLifeSync | ${sType} already exists on entity ${entityId}, skipping`);
        }
    }

    private applySyncRemove(entityId: number, sType: string): void {
        const ctor = (globalThis as any).__entm[sType];
        this.m_world.removeComponent(entityId, ctor);
        logger.log(`applySyncRemove | removed ${sType} from entity ${entityId}`);
    }

    private handleSync(payload: Record<number, Record<string, Record<string, any>>>): void {
        logger.log(`handleSync | received payload for ${Object.keys(payload).length} entity(s)`);
        for (const [netIdStr, components] of Object.entries(payload)) {
            const netId   = Number(netIdStr);
            const entityId = this.m_netIdMap.get(netId);

            for (const [componentName, fields] of Object.entries(components)) {
                const queued = this.m_pendingOps.has(netId);
                const ctor   = (globalThis as any).__entm[componentName];

                if (queued || !entityId || !ctor) {
                    logger.log(`handleSync | queuing sync for netId ${netId}, component ${componentName}`);
                    this.enqueue(netId, { type: 'sync', componentName, fields });
                } else {
                    this.applySync(entityId, netId, componentName, fields);
                }
            }

            if (this.m_pendingOps.has(netId)) this.drain(netId);
        }
    }

    private handleLifeSync(netId: number, sType: string): void {
        logger.log(`handleLifeSync | netId: ${netId}, sType: ${sType}`);
        const entityId = this.m_netIdMap.get(netId);
        const ctor     = (globalThis as any).__entm[sType];

        if (this.m_pendingOps.has(netId) || !entityId || !ctor) {
            logger.log(`handleLifeSync | queuing for netId ${netId}, sType ${sType}`);
            this.enqueue(netId, { type: 'sync_life', sType });
            this.drain(netId);
        } else {
            this.applyLifeSync(entityId, sType);
        }
    }

    private handleSyncRemove(netId: number, sType: string): void {
        logger.log(`handleSyncRemove | netId: ${netId}, sType: ${sType}`);
        const entityId = this.m_netIdMap.get(netId);
        const ctor     = (globalThis as any).__entm[sType];

        if (this.m_pendingOps.has(netId) || !entityId || !ctor) {
            logger.log(`handleSyncRemove | queuing for netId ${netId}, sType ${sType}`);
            this.enqueue(netId, { type: 'sync_remove', sType });
            this.drain(netId);
        } else {
            this.applySyncRemove(entityId, sType);
        }
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
        logger.log(`handleEntityCreate | created entity ${entityId} for netId ${netId}`);
        // drain is triggered via onComponentAdded when NetEntity is mapped
    }

    private handleEntityDestroy(netId: number): void {
        logger.log(`handleEntityDestroy | netId: ${netId}`);
        const entityId = this.m_netIdMap.get(netId);
        if (!entityId) {
            logger.warn(`handleEntityDestroy | unknown netId ${netId}`);
            this.m_pendingOps.delete(netId);
            return;
        }
        this.m_pendingOps.delete(netId);
        this.m_world.destroyEntity(entityId);
        logger.log(`handleEntityDestroy | destroyed entity ${entityId} (netId: ${netId})`);
    }

    private m_netIdMap:   Map<number, number>     = new Map();
    private m_pendingOps: Map<number, QueuedOp[]> = new Map();
}
