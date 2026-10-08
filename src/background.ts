// Runs the sweep about every 15 minutes (Android's minimum) while the app is closed, so
// history keeps filling, alerts can fire and the widget stays current.
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { refreshWidget } from './widget/handler';
import { sweep } from './watch';

const taskName = 'closing-bell-sweep';

TaskManager.defineTask(taskName, async () => {
  try {
    await sweep();
    await refreshWidget();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function ensureBackgroundSweep() {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  if (!(await TaskManager.isTaskRegisteredAsync(taskName))) await BackgroundTask.registerTaskAsync(taskName, { minimumInterval: 15 });
  return true;
}
