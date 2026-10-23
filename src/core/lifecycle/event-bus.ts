import { EventEmitter } from 'node:events';

import { logger } from '../logging';

export interface CourseTopicsChangedEvent {
  courseId: string;
  topicId: string;
  action: 'ADDED' | 'DEACTIVATED' | 'REACTIVATED' | 'DELETED';
}

export type LifecycleEvents = {
  'course.topicsChanged': CourseTopicsChangedEvent;
  [key: string]: unknown;
};

class LifecycleEventBus extends EventEmitter {
  public emitEvent<K extends keyof LifecycleEvents>(
    event: K,
    payload: LifecycleEvents[K],
  ): boolean {
    logger.info({ event, payload }, `[LifecycleEventBus] Emitting event: ${String(event)}`);
    return this.emit(String(event), payload);
  }
}

export const eventBus = new LifecycleEventBus();
