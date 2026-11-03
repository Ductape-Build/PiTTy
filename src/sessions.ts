import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { PiRpcClient } from "./rpc/pi-rpc-client.ts";

export type SessionChoice = {
  path: string;
  id: string;
  name: string;
  modified: Date;
  messageCount: number;
  firstMessage: string;
};

export type SessionDiscoveryProgress = {
  loaded: number;
  total: number;
};

export type SessionDiscoveryState =
  | { kind: "loading"; progress?: SessionDiscoveryProgress }
  | { kind: "success"; choices: SessionChoice[] }
  | { kind: "empty"; choices: [] }
  | { kind: "error"; error: string };

export function mapSessionInfo(info: Omit<SessionChoice, "name"> & { name?: string }): SessionChoice {
  return {
    path: info.path,
    id: info.id,
    name: info.name?.trim() || info.firstMessage.trim().slice(0, 80) || "Unnamed session",
    modified: info.modified,
    messageCount: info.messageCount,
    firstMessage: info.firstMessage,
  };
}

export function prepareSessionChoices(infos: Array<Omit<SessionChoice, "name"> & { name?: string }>, activePath?: string): SessionChoice[] {
  return infos
    .filter((info) => info.path !== activePath)
    .map(mapSessionInfo)
    .sort((a, b) => b.modified.getTime() - a.modified.getTime());
}

export function filterSessionChoices(choices: SessionChoice[], query: string): SessionChoice[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return choices;
  return choices.filter((choice) => [choice.name, choice.firstMessage, choice.id].some((value) => value.toLowerCase().includes(normalized)));
}

export type SessionDiscoveryOptions = {
  client?: Pick<PiRpcClient, "getCapabilities" | "listSessions">;
  onProgress?: (loaded: number, total: number) => void;
};

export async function discoverSessions(cwd: string, activePath?: string, options: SessionDiscoveryOptions = {}): Promise<SessionChoice[]> {
  if (options.client && (await options.client.getCapabilities()).sessionDiscovery) {
    const sessions = await options.client.listSessions();
    return prepareSessionChoices(sessions.map((session) => ({
      ...session,
      modified: new Date(session.modified),
    })), activePath);
  }
  const infos = await SessionManager.list(cwd, undefined, options.onProgress);
  return prepareSessionChoices(infos, activePath);
}
