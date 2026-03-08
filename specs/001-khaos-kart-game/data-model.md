# Data Model: KHAOS KART

**Branch**: `001-khaos-kart-game` | **Date**: 2026-03-07

## Entities

### Character

| Field | Type | Constraints |
| ----- | ---- | ----------- |
| id | string | Unique identifier (e.g., "rico", "zyrx") |
| name | string | Display name |
| speed | integer | 1-10, part of 25-point total |
| acceleration | integer | 1-10, part of 25-point total |
| handling | integer | 1-10, part of 25-point total |
| weight | integer | 1-10, part of 25-point total |
| special | integer | 1-10, part of 25-point total |
| kartModel | string | Reference to kart 3D model/generator |
| kartPhysicsType | enum | "wheeled", "levitating", "tracked", "hybrid" |
| signatureWeapon | WeaponDef | Unique weapon definition |
| passive | PassiveDef | Unique passive ability definition |
| unlockCondition | string or null | Null = base character, string = unlock requirement |
| skins | ColorSkin[] | 3 alternative color schemes + default |

**Validation**: speed + acceleration + handling + weight + special = 25

**State**: Characters are static data. No lifecycle transitions.

### WeaponDef

| Field | Type | Constraints |
| ----- | ---- | ----------- |
| id | string | Unique identifier |
| name | string | Display name |
| description | string | Effect description |
| duration | number (seconds) | 0 for instant effects |
| cooldown | number (seconds) | Minimum time between uses (N/A -- acquired from crates) |
| effectType | enum | "projectile", "area", "self-buff", "debuff", "trap", "clone" |

### PassiveDef

| Field | Type | Constraints |
| ----- | ---- | ----------- |
| id | string | Unique identifier |
| description | string | Effect description |
| triggerCondition | string | When the passive activates |
| effectModifiers | object | Key-value stat/behavior modifiers |

### Circuit

| Field | Type | Constraints |
| ----- | ---- | ----------- |
| id | string | Unique identifier (e.g., "volcan-peak") |
| name | string | Display name |
| theme | string | Visual theme description |
| elevationProfile | enum | "flat", "low", "medium", "high", "extreme" |
| waypoints | Vector3[] | Ordered path points for AI navigation |
| startGrid | Vector3[] | 8 starting positions |
| shortcuts | Shortcut[] | 2+ per circuit |
| weatherPool | WeatherEvent[] | Possible weather events for this circuit |
| hazards | Hazard[] | Dynamic hazard definitions |
| itemCrateSpawns | Vector3[] | Standard item crate positions |
| turretCrateSpawns | Vector3[] | Turret ammo crate positions (crew mode) |
| legendarycrateSpawn | Vector3 | Single legendary item crate position |
| defaultLaps | integer | Default lap count (typically 3) |
| mutatesPerLap | boolean | Whether layout changes between laps (Ruins of Khaos) |

### Shortcut

| Field | Type | Constraints |
| ----- | ---- | ----------- |
| id | string | Unique identifier |
| entryPoint | Vector3 | Entry trigger position |
| exitPoint | Vector3 | Exit position |
| accessCondition | enum | "universal", "item-gated", "character-gated" |
| requiredItemId | string or null | Item needed (if item-gated) |
| requiredCharacterId | string or null | Character needed (if character-gated) |
| timeSaved | number (seconds) | Approximate time advantage |
| riskFactor | string | Description of risk/tradeoff |

### WeatherEvent

| Field | Type | Constraints |
| ----- | ---- | ----------- |
| type | enum | "rain", "blizzard", "ash", "electric-storm", "acid-rain", "blackout", "underwater-storm", "bioluminescence", "dimensional-storm", "gravity-shift" |
| gripModifier | number | -1.0 to 0 (e.g., -0.3 for rain) |
| visibilityModifier | number | 0 to 1.0 (1.0 = full visibility) |
| duration | number (seconds) | 30-90s typically |
| specialEffect | string or null | Additional gameplay effect description |

### Item

| Field | Type | Constraints |
| ----- | ---- | ----------- |
| id | string | Unique identifier |
| name | string | Display name |
| category | enum | "offensive", "defensive", "movement", "track", "legendary", "signature" |
| description | string | Effect description |
| duration | number (seconds) | 0 for instant |
| areaOfEffect | number (meters) | 0 for targeted/self |
| probabilityWeight | object | Position-based weight curve (position 1-8 → weight) |

### Race (runtime state)

| Field | Type | Constraints |
| ----- | ---- | ----------- |
| id | string | Unique race identifier |
| mode | enum | "solo", "time-trial", "grand-prix", "local-multi", "online-multi" |
| circuitId | string | Reference to Circuit |
| lapCount | integer | 1-10 |
| weatherSetting | enum | "random", "forced", "off" |
| forcedWeather | string or null | Weather type if forced |
| itemsEnabled | boolean | |
| crewModeEnabled | boolean | |
| difficulty | enum | "novice", "normal", "expert" (solo/GP only) |
| participants | RaceParticipant[] | Max 8 karts |
| state | enum | "countdown", "racing", "finished" |
| currentLap | map | participantId → current lap number |
| standings | string[] | Ordered participant IDs by position |
| timer | number | Elapsed race time in seconds |
| activeWeather | WeatherEvent or null | Currently active weather |
| activeHazards | Hazard[] | Currently active dynamic hazards |

**State transitions**: countdown → racing → finished

### RaceParticipant

| Field | Type | Constraints |
| ----- | ---- | ----------- |
| id | string | Unique participant ID |
| characterId | string | Reference to Character |
| skinIndex | integer | 0 = default, 1-3 = alt skins |
| isHuman | boolean | |
| isDriver | boolean | True for driver in crew mode, true for solo |
| crewPartnerId | string or null | Partner participant ID in crew mode |
| currentItem | string or null | Item ID currently held |
| position | Vector3 | Current world position |
| rotation | Quaternion | Current orientation |
| velocity | Vector3 | Current velocity |
| speed | number | Current scalar speed |
| lapProgress | number | 0.0-1.0 progress through current lap |
| lapCount | integer | Completed laps |
| finished | boolean | Has crossed finish line on final lap |
| finishTime | number or null | Time when finished |
| disconnected | boolean | Online: player disconnected |

### Room (online multiplayer)

| Field | Type | Constraints |
| ----- | ---- | ----------- |
| id | string | Server-generated unique ID |
| code | string | 6-digit numeric code |
| accessType | enum | "public", "private" |
| hostPlayerId | string | Creator's player ID |
| settings | RoomSettings | Race configuration |
| players | RoomPlayer[] | Max 8 |
| chatMessages | ChatMessage[] | Lobby chat history |
| state | enum | "lobby", "starting", "in-race", "results" |
| createdAt | timestamp | |

**State transitions**: lobby → starting → in-race → results → lobby (or disposed)

### RoomSettings

| Field | Type | Constraints |
| ----- | ---- | ----------- |
| circuitId | string | Selected circuit |
| lapCount | integer | 1-10 |
| weatherSetting | enum | "random", "forced", "off" |
| forcedWeather | string or null | |
| itemsEnabled | boolean | |
| crewModeEnabled | boolean | |

### RoomPlayer

| Field | Type | Constraints |
| ----- | ---- | ----------- |
| id | string | Player connection ID |
| displayName | string | Player-chosen name |
| characterId | string or null | Selected character (null = not yet chosen) |
| skinIndex | integer | |
| ready | boolean | Ready to start |
| reconnectToken | string | For 10s reconnection grace period |
| connected | boolean | |

### ChatMessage

| Field | Type | Constraints |
| ----- | ---- | ----------- |
| playerId | string | Sender |
| text | string | Max 200 characters |
| timestamp | number | Server timestamp |

### PlayerProfile (localStorage)

| Field | Type | Constraints |
| ----- | ---- | ----------- |
| bestTimes | map | circuitId → best time in seconds |
| totalRaces | integer | |
| totalWins | integer | |
| totalItemsUsed | integer | |
| totalDistance | number | In game units |
| unlockedCharacters | string[] | Character IDs |
| unlockedSkins | map | characterId → unlocked skin indices |
| settings | SettingsData | All user preferences |

### GhostReplay (localStorage)

| Field | Type | Constraints |
| ----- | ---- | ----------- |
| circuitId | string | |
| characterId | string | |
| totalTime | number | Seconds |
| frames | GhostFrame[] | Position/rotation per frame |

### GhostFrame

| Field | Type | Constraints |
| ----- | ---- | ----------- |
| time | number | Seconds from race start |
| position | Vector3 | |
| rotation | number | Yaw angle |

## Relationships

```
Character 1──* ColorSkin
Character 1──1 WeaponDef
Character 1──1 PassiveDef
Circuit 1──* Shortcut
Circuit 1──* WeatherEvent
Circuit 1──* Hazard
Race *──1 Circuit
Race 1──* RaceParticipant
RaceParticipant *──1 Character
Room 1──1 RoomSettings
Room 1──* RoomPlayer
Room 1──* ChatMessage
PlayerProfile 1──* GhostReplay
```
