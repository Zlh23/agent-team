import { describe, expect, it } from 'vitest'
import { PERMISSION_LABELS, TASK_STATE_LABELS } from '../src/client/labels.js'

describe('labels', () => {
  it('keeps TASK_STATE_LABELS intact', () => {
    expect(TASK_STATE_LABELS).toEqual({
      pending: '待处理',
      assigned: '已分配',
      in_progress: '进行中',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消',
    })
  })

  it('keeps PERMISSION_LABELS intact', () => {
    expect(PERMISSION_LABELS).toEqual({
      'read-only': '只读',
      'workspace-write': '允许写入文件',
      'danger-full-access': '完全访问',
    })
  })
})
