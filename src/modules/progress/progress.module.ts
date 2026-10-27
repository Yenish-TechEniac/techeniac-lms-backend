import { eventBus } from '../../core/lifecycle';
import { progressService } from './progress.service';

let listenersRegistered = false;

export function registerProgressLifecycleListeners(): void {
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;

  eventBus.onEvent('allocation.created', async (payload) => {
    await progressService.handleAllocationCreated(payload);
  });

  eventBus.onEvent('course.topicsChanged', async (payload) => {
    await progressService.handleCourseTopicsChanged(payload);
  });
}
