## Why

PiTTy currently discovers sessions exclusively through the Pi SDK's local JSONL session store. A Pi-compatible RPC backend with an authoritative remote or daemon-owned session store cannot populate the dashboard or `/resume` without duplicating transcripts. Session references must remain opaque so discovery, switching, tabs, and forks do not require filesystem paths.

## What Changes

- Probe the optional `get_capabilities` RPC once per client process. A standard Pi unknown/unsupported-command response selects the existing `SessionManager.list(cwd)` discovery path. Other failures remain visible.
- When `sessionDiscovery: true` is advertised, discover exclusively through `list_sessions`, without filtering backend sessions by the UI cwd or falling back to filesystem sessions after backend errors.
- Allow discovery options to receive a session-capable client and the existing progress callback. Convert backend ISO timestamps into the UI's `Date` shape; pass session references unchanged.
- Show the backend's advertised identity alongside the PiTTy version. Explicit `extensions: false` or `packageManagement: false` disables optional Pi integration/package controls rather than installing packages into another backend. Unsupported optional command-list probes remain nonfatal during startup.
- Reject unsuccessful prompt, steering, follow-up, abort, and configuration responses instead of reporting successful operations.

## RPC Contract

Both commands use the existing newline-delimited RPC request/response envelope, including correlated `id`, `command`, `success`, `data`, and `error` fields.

`get_capabilities` takes no additional fields and returns optional fields:

```json
{"sessionDiscovery":true,"backend":"example-daemon","displayName":"Example","extensions":false,"packageManagement":false}
```

Omitted capability fields retain standard Pi behavior. `backend` is a stable backend identifier and `displayName` is a user-facing identity; neither selects an implementation-specific discovery path. Unsupported capability probes return `success: false` with an unknown/unsupported command error. Successful capability responses return an object, including an empty object when no extensions are available.

`list_sessions` takes no additional fields and returns:

```json
{"sessions":[{"path":"backend:42","id":"42","name":"Conversation","modified":"2026-11-03T10:00:00.000Z","messageCount":3,"firstMessage":"Initial request"}]}
```

`name` is optional. The backend determines session scope; `path` is an opaque session reference accepted by `switch_session.sessionPath` and launch `--session`, and returned as `get_state.sessionFile`, including after forks. It need not identify a real file. No transcript mirror is required or created. An advertised discovery failure is an error, not permission to substitute another store's sessions. Unsupported mutations always return `success: false` with an actionable error.

## Capabilities

### New Capabilities

- `backend-session-discovery`: opt-in backend-owned session enumeration with opaque references, backend identity, and optional Pi integration support flags.

### Modified Capabilities

- RPC mutations expose unsuccessful responses to existing UI error handling.

## Impact

- Changes the RPC client, session discovery options, app wiring, sidebar identity, and focused RPC/session/tab regression fixtures.
- Standard Pi discovery remains the default. No new dependencies, backend-specific discovery conditions, session-file writes, or changes to agent execution ownership.
- Validation: typecheck, unit tests, and the existing UI render suite; coverage includes standard Pi fallback, backend ISO dates and cross-workspace sessions, opaque switching/restarting/forking, and rejected controls.
