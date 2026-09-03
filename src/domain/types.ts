import type { z } from 'zod'
import type {
  addTeamMemberInputSchema,
  assistantSnapshotSchema,
  assistantTemplateSchema,
  createAssistantInputSchema,
  createTeamDraftInputSchema,
  createTeamMemberInputSchema,
  memberRuntimeStateSchema,
  retiredMemberSessionSchema,
  teamAggregateSchema,
  teamMemberSlotSchema,
  teamMessageSchema,
  teamTaskSchema,
  updateAssistantInputSchema,
} from './schemas.js'

export type AssistantSnapshot = z.infer<typeof assistantSnapshotSchema>
export type AssistantTemplate = z.infer<typeof assistantTemplateSchema>
export type CreateAssistantInput = z.infer<typeof createAssistantInputSchema>
export type UpdateAssistantInput = z.infer<typeof updateAssistantInputSchema>
export type MemberRuntimeState = z.infer<typeof memberRuntimeStateSchema>
export type TeamMemberSlot = z.infer<typeof teamMemberSlotSchema>
export type RetiredMemberSession = z.infer<typeof retiredMemberSessionSchema>
export type TeamTask = z.infer<typeof teamTaskSchema>
export type TeamAggregate = z.infer<typeof teamAggregateSchema>
export type TeamMessage = z.infer<typeof teamMessageSchema>
export type CreateTeamMemberInput = z.infer<typeof createTeamMemberInputSchema>
export type AddTeamMemberInput = z.infer<typeof addTeamMemberInputSchema>
export type CreateTeamDraftInput = z.infer<typeof createTeamDraftInputSchema>

export interface Page<T> {
  items: T[]
  total: number
}

export function snapshotAssistant(assistant: AssistantTemplate): AssistantSnapshot {
  return {
    assistantId: assistant.id,
    revision: assistant.revision,
    name: assistant.name,
    instructions: assistant.instructions,
    provider: assistant.provider,
    model: assistant.model,
    agentPresetId: assistant.agentPresetId,
    permissionPresetId: assistant.permissionPresetId,
  }
}
