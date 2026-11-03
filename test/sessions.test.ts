import { describe, expect, spyOn, test } from "bun:test";
import { discoverSessions, filterSessionChoices, mapSessionInfo, prepareSessionChoices } from "../src/sessions.ts";
import { SessionManager, type SessionInfo } from "@earendil-works/pi-coding-agent";

const info = (path: string, modified: string, name?: string, id = path, firstMessage = "Initial request"): SessionInfo => ({ path, id, cwd: "/tmp/project", ...(name ? { name } : {}), created: new Date(modified), modified: new Date(modified), messageCount: 2, firstMessage, allMessagesText: firstMessage });

describe("session choices", () => {
  test("maps, excludes active, and sorts recent first", () => {
    const result = prepareSessionChoices([info("old", "2020-01-01"), info("new", "2024-01-01", "Named")], "old");
    expect(result.map((choice) => choice.path)).toEqual(["new"]);
    expect(mapSessionInfo(info("x", "2024-01-01")).name).toBe("Initial request");
  });
  test("filters name, id, and first message independently", () => {
    const choices = prepareSessionChoices([
      info("name-path", "2024-01-01", "Planning notes", "name-id", "Discuss release"),
      info("id-path", "2024-01-02", "Unrelated", "distinct-session-id", "Another request"),
      info("message-path", "2024-01-03", "Other", "message-id", "Investigate parser"),
    ]);
    expect(filterSessionChoices(choices, "planning").map((choice) => choice.id)).toEqual(["name-id"]);
    expect(filterSessionChoices(choices, "distinct-session-id").map((choice) => choice.id)).toEqual(["distinct-session-id"]);
    expect(filterSessionChoices(choices, "investigate parser").map((choice) => choice.id)).toEqual(["message-id"]);
    expect(filterSessionChoices(choices, "zzz")).toHaveLength(0);
  });

  test("uses advertised backend discovery across working directories without reading JSONL", async () => {
    const list = spyOn(SessionManager, "list").mockImplementation(async () => {
      throw new Error("Filesystem discovery must not run for this backend");
    });
    try {
      const result = await discoverSessions("/unrelated/workspace", "iris:42", {
        client: {
          getCapabilities: async () => ({ sessionDiscovery: true }),
          listSessions: async () => [
            { path: "iris:41", id: "41", name: "Slack conversation", modified: "2026-11-01T10:00:00.000Z", messageCount: 12, firstMessage: "Slack request" },
            { path: "iris:42", id: "42", name: "Active terminal", modified: "2026-11-02T10:00:00.000Z", messageCount: 3, firstMessage: "Terminal request" },
            { path: "iris:43", id: "43", modified: "2026-11-03T10:00:00.000Z", messageCount: 2, firstMessage: "Another workspace" },
          ],
        },
      });
      expect(list).not.toHaveBeenCalled();
      expect(result.map((choice) => choice.path)).toEqual(["iris:43", "iris:41"]);
      expect(result[0]?.modified).toBeInstanceOf(Date);
      expect(result[1]?.name).toBe("Slack conversation");
    } finally {
      list.mockRestore();
    }
  });

  test("keeps Pi filesystem discovery and progress when capabilities are absent", async () => {
    const progress = () => {};
    const list = spyOn(SessionManager, "list").mockResolvedValue([info("/pi/session.jsonl", "2026-11-01")]);
    try {
      const result = await discoverSessions("/tmp/project", undefined, {
        onProgress: progress,
        client: {
          getCapabilities: async () => ({}),
          listSessions: async () => { throw new Error("Backend discovery was not advertised"); },
        },
      });
      expect(list).toHaveBeenCalledWith("/tmp/project", undefined, progress);
      expect(result[0]?.path).toBe("/pi/session.jsonl");
      expect((await discoverSessions("/tmp/project"))[0]?.path).toBe("/pi/session.jsonl");
      expect(list).toHaveBeenCalledTimes(2);
    } finally {
      list.mockRestore();
    }
  });

  test("surfaces advertised backend discovery failures rather than substituting filesystem sessions", async () => {
    await expect(discoverSessions("/tmp/project", undefined, {
      client: {
        getCapabilities: async () => ({ sessionDiscovery: true }),
        listSessions: async () => { throw new Error("Backend unavailable"); },
      },
    })).rejects.toThrow("Backend unavailable");
  });
});
