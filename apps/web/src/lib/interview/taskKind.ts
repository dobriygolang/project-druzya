/** Task types that use code editor + sandbox instead of free-text answer. */
export function isCodeTask(taskType: string | undefined): boolean {
  if (!taskType) return false
  return taskType === 'algorithm' || taskType === 'live_coding' || taskType === 'sql'
}

export function isSystemDesignTask(taskType: string | undefined): boolean {
  return taskType === 'system_design'
}
