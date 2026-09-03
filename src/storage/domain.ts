import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import {
  assistantTemplateSchema,
  teamActivitySchema,
  teamAggregateSchema,
  teamMessageSchema,
} from '../domain/schemas.js'
import type {
  AssistantTemplate,
  TeamActivity,
  TeamAggregate,
  TeamMessage,
} from '../domain/types.js'

export type AssistantId = string
export type TeamId = string
export type MessageId = string
export type ActivityId = string

export const agentTeamDomainSpec = defineDomain({
  name: 'agent_team',
  version: 1,
  tables: {
    assistants: domainTable<AssistantId, AssistantTemplate>(assistantTemplateSchema),
    teams: domainTable<TeamId, TeamAggregate>(teamAggregateSchema),
    messages: domainTable<MessageId, TeamMessage>(teamMessageSchema),
    activities: domainTable<ActivityId, TeamActivity>(teamActivitySchema),
  },
})

