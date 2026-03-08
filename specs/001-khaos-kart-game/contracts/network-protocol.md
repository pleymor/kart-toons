# Network Protocol Contract: KHAOS KART

**Branch**: `001-khaos-kart-game` | **Date**: 2026-03-07

## Overview

Client-server communication over WebSocket (Socket.io). Server-authoritative model with client-side prediction. Server ticks at 20Hz.

## Client → Server Messages

### `player:input`
Sent every client frame (60Hz). Server processes on next tick.
```
{
  tick: number,           // Client tick number
  steering: number,       // -1.0 (left) to 1.0 (right)
  throttle: number,       // 0.0 to 1.0
  brake: boolean,
  drift: boolean,
  useItem: boolean,
  lookBehind: boolean,
  horn: boolean
}
```

### `gunner:input` (crew mode)
Sent by gunner player.
```
{
  tick: number,
  aimYaw: number,         // Turret horizontal angle (radians)
  aimPitch: number,       // Turret vertical angle (radians)
  fire: boolean
}
```

### `room:create`
```
{
  displayName: string,
  accessType: "public" | "private",
  settings: RoomSettings
}
→ Response: { roomId: string, code: string }
```

### `room:join`
```
{
  code: string,
  displayName: string
}
→ Response: { roomId: string, players: RoomPlayer[], settings: RoomSettings }
```

### `room:ready`
```
{ ready: boolean }
```

### `room:select-character`
```
{
  characterId: string,
  skinIndex: number
}
```

### `room:update-settings` (host only)
```
{ settings: RoomSettings }
```

### `room:start` (host only)
```
{}
→ Server broadcasts race:countdown to all players
```

### `room:chat`
```
{ text: string }   // Max 200 characters
```

### `room:reconnect`
```
{ reconnectToken: string }
→ Response: { snapshot: GameStateSnapshot }
```

## Server → Client Messages

### `race:countdown`
```
{ countdown: number }   // 3, 2, 1, 0 (go)
```

### `race:snapshot` (20Hz)
Delta-compressed. Only changed fields sent.
```
{
  tick: number,
  participants: [{
    id: string,
    position: [x, y, z],      // Fixed-point, 0.01 precision
    yaw: number,               // Radians
    speed: number,
    velocity: [vx, vy, vz],
    steerAngle: number,
    drifting: boolean,
    currentItem: string | null,
    lapProgress: number,
    lapCount: number,
    activeEffects: string[]    // Active buff/debuff IDs
  }],
  events: GameEvent[],         // Item uses, collisions, pickups
  weather: string | null,      // Active weather type
  hazards: HazardState[]       // Active dynamic hazards
}
```

### `race:event`
Discrete game events (item pickups, hits, finishes).
```
{
  type: "item-pickup" | "item-use" | "item-hit" | "collision" | "lap-complete" | "race-finish" | "weather-change" | "hazard-spawn",
  data: object               // Event-specific payload
}
```

### `race:standings`
```
{
  standings: [{ id: string, position: number, lapCount: number, lapProgress: number }],
  raceTimer: number
}
```

### `race:results`
```
{
  finishOrder: [{ id: string, time: number, characterId: string }],
  stats: { ... }
}
```

### `room:player-joined`
```
{ player: RoomPlayer }
```

### `room:player-left`
```
{ playerId: string }
```

### `room:player-disconnected`
```
{ playerId: string, graceSeconds: number }
```

### `room:player-reconnected`
```
{ playerId: string }
```

### `room:chat-message`
```
{ playerId: string, displayName: string, text: string, timestamp: number }
```

### `room:settings-updated`
```
{ settings: RoomSettings }
```

## Bandwidth Budget

| Direction | Rate | Payload | Bandwidth |
| --------- | ---- | ------- | --------- |
| Client → Server | 60Hz | ~60 bytes | ~3.6 KB/s |
| Server → Client | 20Hz | ~640 bytes (8 karts, delta compressed ~300 bytes) | ~6 KB/s |
| **Total per client** | | | **~10 KB/s** (~80 kbps) |

Well under the 256 kbps comfort threshold.
