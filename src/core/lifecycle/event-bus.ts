import { EventEmitter } from 'node:events';

import { logger } from '../logging';

export interface CourseTopicsChangedEvent {
  courseId: string;
  topicId: string;
  action: 'ADDED' | 'DEACTIVATED' | 'REACTIVATED' | 'DELETED';
}

export type LifecycleEvents = {
  'course.topicsChanged': CourseTopicsChangedEvent;
};

class LifecycleEventBus extends EventEmitter {
  public emitEvent<K extends keyof LifecycleEvents>(
    event: K,
    payload: LifecycleEvents[K],
  ): boolean {
    logger.info({ event, payload }, `[LifecycleEventBus] Emitting event: ${String(event)}`);
    return this.emit(String(event), payload);
  }

  public onEvent<K extends keyof LifecycleEvents>(
    event: K,
    listener: (payload: LifecycleEvents[K]) => void | Promise<void>,
  ): this {
    return this.on(String(event), (payload: LifecycleEvents[K]) => {
      void Promise.resolve(listener(payload)).catch((err: unknown) => {
        logger.error({ err, event: String(event) }, '[LifecycleEventBus] Error in event listener');
      });
    });
  }
}

export const eventBus = new LifecycleEventBus();
