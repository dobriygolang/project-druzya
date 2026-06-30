export const TASK_DRAG_MIME = 'application/x-hone-task-id';

export function readDraggedTaskId(dataTransfer: DataTransfer): string | null {
  const typed = dataTransfer.getData(TASK_DRAG_MIME);
  if (typed) return typed;
  const plain = dataTransfer.getData('text/plain');
  return plain || null;
}

export function setDraggedTaskId(dataTransfer: DataTransfer, taskId: string): void {
  dataTransfer.setData(TASK_DRAG_MIME, taskId);
  dataTransfer.setData('text/plain', taskId);
  dataTransfer.effectAllowed = 'move';
}
