import { createNote, listNotes } from '@features/notes/api/notesClient';
import { createTask, listTasks, scheduleTask } from '@features/tasks/api/tasks';
import { buildDefaultScheduleDate, toDayKey } from '@pages/TaskBoard/lib/dates';

export async function seedDemoData(): Promise<void> {
  const tasks = await listTasks();
  if (tasks.length === 0) {
    const today = new Date();
    const dayKey = toDayKey(today);
    const start = buildDefaultScheduleDate(today);
    let t = await createTask({ title: 'Write release notes' });
    t = await scheduleTask(t.id, start.toISOString(), 30);
    await createTask({ title: 'Pair on live room flow' });
    void dayKey;
    void t;
  }

  const { notes } = await listNotes();
  if (notes.length === 0) {
    await createNote(
      'Weekly plan',
      '## Focus\n\n- Ship landing demo\n- Review task board UX\n- Pomodoro: 4 blocks today\n\n> Calm tools help you finish what matters.',
    );
  }
}
