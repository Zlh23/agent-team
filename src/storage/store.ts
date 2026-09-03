import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'
import type {
  AssistantTemplate,
  TeamAggregate,
  TeamMessage,
} from '../domain/types.js'
import { agentTeamDomainSpec } from './domain.js'

export interface AgentTeamStore {
  getAssistant(id: string): AssistantTemplate | undefined
  listAssistants(): AssistantTemplate[]
  putAssistant(value: AssistantTemplate): Promise<void>
  updateAssistant(id: string, update: (current: AssistantTemplate) => AssistantTemplate): Promise<AssistantTemplate>
  deleteAssistant(id: string): Promise<boolean>

  getTeam(id: string): TeamAggregate | undefined
  listTeams(): TeamAggregate[]
  putTeam(value: TeamAggregate): Promise<void>
  updateTeam(id: string, update: (current: TeamAggregate) => TeamAggregate): Promise<TeamAggregate>
  deleteTeam(id: string): Promise<boolean>

  listMessages(teamId: string): TeamMessage[]
  putMessage(value: TeamMessage): Promise<void>
  deleteMessage(id: string): Promise<boolean>
}

export class DomainAgentTeamStore implements AgentTeamStore {
  private readonly assistants: KvTable<string, AssistantTemplate>
  private readonly teams: KvTable<string, TeamAggregate>
  private readonly messages: KvTable<string, TeamMessage>

  constructor(readonly domain: Domain<typeof agentTeamDomainSpec>) {
    this.assistants = domain.table('assistants')
    this.teams = domain.table('teams')
    this.messages = domain.table('messages')
  }

  getAssistant(id: string): AssistantTemplate | undefined {
    return this.assistants.get(id)
  }

  listAssistants(): AssistantTemplate[] {
    return values(this.assistants)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
  }

  putAssistant(value: AssistantTemplate): Promise<void> {
    return this.assistants.put(value.id, value)
  }

  updateAssistant(
    id: string,
    update: (current: AssistantTemplate) => AssistantTemplate,
  ): Promise<AssistantTemplate> {
    return this.assistants.update(id, update)
  }

  deleteAssistant(id: string): Promise<boolean> {
    return this.assistants.delete(id)
  }

  getTeam(id: string): TeamAggregate | undefined {
    return this.teams.get(id)
  }

  listTeams(): TeamAggregate[] {
    return values(this.teams)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id))
  }

  putTeam(value: TeamAggregate): Promise<void> {
    return this.teams.put(value.id, value)
  }

  updateTeam(id: string, update: (current: TeamAggregate) => TeamAggregate): Promise<TeamAggregate> {
    return this.teams.update(id, update)
  }

  deleteTeam(id: string): Promise<boolean> {
    return this.teams.delete(id)
  }

  listMessages(teamId: string): TeamMessage[] {
    return values(this.messages)
      .filter(message => message.teamId === teamId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
  }

  putMessage(value: TeamMessage): Promise<void> {
    return this.messages.put(value.id, value)
  }

  deleteMessage(id: string): Promise<boolean> {
    return this.messages.delete(id)
  }
}

function values<K extends string, V>(table: KvTable<K, V>): V[] {
  return [...table.entries()].map(([, value]) => value)
}
