# Feature Specification: KHAOS KART - Multiplayer HTML5 Kart Racing Game

**Feature Branch**: `001-khaos-kart-game`
**Created**: 2026-03-07
**Status**: Draft
**Input**: User description: "Full HTML5/WebGL kart racing game with cell shading visuals, real-time multiplayer, 8 characters, 5 circuits, item system, local split-screen, crew mode, mobile support, weather system, and AI opponents."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Solo Race Against AI (Priority: P1)

A player opens the game in their browser, selects a character from the roster, picks a circuit, and races against 7 AI-controlled opponents. The player drives their kart using keyboard controls, collects items from crates on the track, uses items offensively or defensively, and competes to finish in the highest position across multiple laps.

**Why this priority**: The solo race is the core gameplay loop. Without a functional single-player racing experience (physics, controls, AI, items, circuits), no other mode can exist. This is the MVP that proves the game works.

**Independent Test**: Can be fully tested by launching a solo race, driving one full circuit with items and AI, and verifying the player can finish and see results. Delivers the complete core racing experience.

**Acceptance Scenarios**:

1. **Given** the player is on the main menu, **When** they select a character, a circuit, and start a solo race, **Then** the race begins with a countdown, the player's kart and 7 AI karts are placed on the starting grid, and the race starts after the countdown.
2. **Given** the player is racing, **When** they drive over an item crate, **Then** they receive a random item displayed in their HUD, weighted by their current race position (players further behind get stronger items).
3. **Given** the player has an item, **When** they press the item button, **Then** the item activates with its specific effect (projectile, trap, boost, etc.) with appropriate visual and audio feedback.
4. **Given** the player completes the required number of laps, **When** they cross the finish line, **Then** the race ends, a results screen shows final standings, and the player's time is recorded.
5. **Given** the player is racing, **When** weather changes occur on the circuit, **Then** visual effects appear (rain, snow, ash, etc.) and gameplay is affected (grip changes, visibility changes) according to the weather type.

---

### User Story 2 - Character Selection and Differentiated Physics (Priority: P1)

A player browses the 8-character roster, each with unique stats (Speed, Acceleration, Handling, Weight, Special), a unique kart design, a signature weapon, and a passive ability. The chosen character fundamentally changes how the kart feels and what strategies are viable.

**Why this priority**: Character differentiation is what makes the game interesting and replayable. Without distinct characters, the game is a generic racer. This is co-priority with the core race loop because they are inseparable.

**Independent Test**: Can be tested by selecting different characters and verifying that driving feel, stats, passive abilities, and signature weapons differ meaningfully between each character.

**Acceptance Scenarios**:

1. **Given** the player is on the character selection screen, **When** they browse characters, **Then** they see each character's name, visual design, stats (Speed, Acceleration, Handling, Weight, Special totaling 25 points), kart description, signature weapon, and passive ability.
2. **Given** the player selects a heavy character (e.g., Krogash, Weight 8), **When** they race, **Then** the kart is slower to accelerate but harder to knock off course, and lighter karts that collide with them are pushed away.
3. **Given** the player selects a character with unique physics (e.g., Zyrx's levitating saucer), **When** they drive on mud or ice, **Then** their kart is immune to surface grip penalties due to the levitation passive.
4. **Given** the player picks up their signature weapon item, **When** they activate it, **Then** the character-specific effect triggers (e.g., Rico's grappling hook pulls a kart back while boosting Rico forward).

---

### User Story 3 - Circuit Variety with Shortcuts and Dynamic Elements (Priority: P1)

A player races on one of 5 distinct themed circuits, each with unique elevation changes, environmental hazards, conditional shortcuts (some requiring specific items or characters), and dynamic weather that affects gameplay.

**Why this priority**: Circuits are the stages where gameplay happens. Without varied, well-designed circuits with interactive elements, the game lacks content and replayability. Co-priority with core racing.

**Independent Test**: Can be tested by racing each circuit and verifying unique theme, elevation changes, at least 2 shortcuts per circuit (with correct access conditions), dynamic hazards, and weather effects.

**Acceptance Scenarios**:

1. **Given** the player is racing on Volcan Peak, **When** an eruption event triggers, **Then** a section of the track becomes temporarily blocked by lava, forcing an alternate route, and falling rocks create dynamic obstacles.
2. **Given** the player is racing on Ruins of Khaos, **When** they complete a lap, **Then** a section of the circuit may change layout via portal activation/deactivation, requiring real-time adaptation.
3. **Given** the player is racing on Abyssal Reef as Sharko, **When** they enter the underwater current shortcut, **Then** they accelerate through it, while other characters are slowed down.
4. **Given** the player has a Levitator item on Neon City Underground, **When** they use it at the specific ramp, **Then** they can access the rooftop shortcut that is otherwise inaccessible.

---

### User Story 4 - Local Multiplayer Split-Screen (Priority: P2)

Two to four players on the same computer race together using split-screen, each with their own controls. The screen divides into sections (horizontal, vertical, or quadrants) depending on player count and configuration.

**Why this priority**: Local multiplayer is a key differentiator and delivers immediate social fun without requiring network infrastructure. It builds on the solo race foundation.

**Independent Test**: Can be tested by starting a 2-player local game, verifying both players have independent controls and viewports, and completing a race together.

**Acceptance Scenarios**:

1. **Given** 2 players want to play locally, **When** they start a local multiplayer race, **Then** the screen splits into two viewports (horizontal or vertical, configurable), each player controls their kart independently with their own key mapping.
2. **Given** 4 players are in a local game, **When** the race starts, **Then** the screen divides into 4 quadrants, each rendering the race from that player's perspective.
3. **Given** players are in local multiplayer, **When** they open the pause menu, **Then** the game pauses for all players, and split-screen orientation can be changed in settings.

---

### User Story 5 - Crew Mode: Driver/Gunner Asymmetric Co-op (Priority: P2)

Two players share a single kart: one drives (3rd person view, controls steering and acceleration) while the other operates the turret (FPS view from rear turret, aims and fires weapons independently of kart direction). Each player has their own control mapping.

**Why this priority**: This is the game's most unique differentiator. No other kart racer offers this asymmetric co-op mode. It builds on local multiplayer but adds a completely new gameplay dimension.

**Independent Test**: Can be tested by starting a crew mode race, verifying the driver controls movement while the gunner independently aims and fires, with both roles displayed on split viewports.

**Acceptance Scenarios**:

1. **Given** 2 players select crew mode, **When** the race starts, **Then** one viewport shows the driver's 3rd-person view and the other shows the gunner's FPS turret view, both on the same kart.
2. **Given** the gunner is aiming the turret, **When** they rotate the aim left/right/up/down, **Then** the turret rotates independently from the kart's driving direction.
3. **Given** the driver drives over a standard item crate, **When** the crate is collected, **Then** the item goes to the driver's item slot; when the kart drives over a turret ammo crate, the item goes to the gunner's slot. Each role uses their own item independently.
4. **Given** the gunner has an item, **When** they press fire, **Then** the item is launched from the turret in the direction the gunner is aiming, not the direction the kart is facing.

---

### User Story 6 - Online Multiplayer with Room System (Priority: P3)

Players create or join online rooms (public or private with 6-digit code) to race together. Up to 8 players per room. The room creator configures race settings (circuit, laps, weather, items on/off, crew mode on/off). Players chat in the lobby before the race starts.

**Why this priority**: Online multiplayer extends the game's reach beyond local play but requires server infrastructure. It builds on the complete local gameplay experience.

**Independent Test**: Can be tested by creating a room, having a second client join via room code, verifying both players see each other in the lobby, and completing a synchronized race.

**Acceptance Scenarios**:

1. **Given** a player creates a private room, **When** the room is created, **Then** a unique 6-digit code is generated and displayed, and the creator can configure race settings.
2. **Given** a player enters a valid room code, **When** they join, **Then** they appear in the lobby, see other players, and can use the text chat.
3. **Given** all players are ready in the lobby, **When** the host starts the race, **Then** all clients synchronize and begin the race simultaneously with consistent game state.
4. **Given** a player loses connection during a race, **When** they reconnect within 10 seconds, **Then** they rejoin at their last known position without losing race progress.

---

### User Story 7 - Mobile Touch Controls and Responsive Experience (Priority: P3)

A player on a smartphone or tablet plays the game using virtual touch controls (joystick for steering, buttons for accelerate/brake/items). The game forces landscape orientation, adapts HUD layout for touch, and automatically applies performance-optimized settings.

**Why this priority**: Mobile support broadens the audience significantly but requires a complete input system redesign. It builds on the fully working desktop game.

**Independent Test**: Can be tested on a mobile device by verifying touch joystick controls steering, buttons control acceleration/braking/items, HUD is readable, and performance stays smooth.

**Acceptance Scenarios**:

1. **Given** a player opens the game on a mobile device in portrait mode, **When** the game loads, **Then** a message prompts them to rotate to landscape orientation.
2. **Given** a player is on mobile in landscape, **When** they touch the left side of the screen, **Then** a virtual joystick appears for steering; a button on the right side controls acceleration.
3. **Given** a mobile player enables gyroscope in settings, **When** they tilt the device, **Then** the kart steers proportionally to the tilt angle.
4. **Given** the game detects a mobile device, **When** the game loads, **Then** it automatically applies a "Low" quality profile (shadows off, reduced particles, 75% render resolution) to maintain smooth performance.

---

### User Story 8 - Time Trial and Grand Prix Modes (Priority: P3)

A player races alone against the clock in Time Trial mode with a recorded ghost, or competes in a Grand Prix series of 4 consecutive circuits with a points system to crown an overall winner.

**Why this priority**: These modes add depth and replayability to the solo experience but are not required for the core gameplay loop.

**Independent Test**: Can be tested by completing a time trial run, verifying ghost recording/playback, and completing a 4-circuit Grand Prix with cumulative scoring.

**Acceptance Scenarios**:

1. **Given** the player selects Time Trial, **When** they complete a lap, **Then** their time is recorded, and if it's a personal best, the ghost replay is saved locally.
2. **Given** the player starts a new Time Trial on a circuit where they have a saved ghost, **When** they race, **Then** a semi-transparent ghost kart replays their best run alongside them.
3. **Given** the player starts a Grand Prix, **When** they complete all 4 circuits, **Then** points are awarded based on finishing position per race, and a final standings screen shows the Grand Prix champion.

---

### User Story 9 - Pause Menu and Settings (Priority: P2)

A player pauses the game mid-race to access a comprehensive settings menu covering controls (key remapping for multiple players), audio (volume sliders per category, spatial audio toggle), video (quality presets, individual toggles for shadows/particles/weather/reflections), gameplay (steering assist, minimap size, language), and accessibility (text size, colorblind modes, strobe reduction).

**Why this priority**: Settings are essential for player comfort and accessibility. Without configurable controls and quality options, the game is harder to use across different hardware and player needs.

**Independent Test**: Can be tested by opening the pause menu, changing settings in each category, resuming, and verifying changes persist.

**Acceptance Scenarios**:

1. **Given** the player presses Escape during a race, **When** the pause menu opens, **Then** the game pauses, a glassmorphism overlay appears with slide-in animation, and all menu sections are accessible.
2. **Given** the player navigates to Controls settings, **When** they click on an action to remap, **Then** the system waits for a key press and assigns the new key to that action.
3. **Given** the player changes video quality to "Low", **When** they resume the race, **Then** shadows, particles, and post-processing are reduced accordingly, and frame rate improves.
4. **Given** the player enables colorblind mode, **When** they resume, **Then** the game's color scheme adjusts to accommodate the selected type (Deuteranopia or Protanopia).

---

### User Story 10 - Progression and Unlockables (Priority: P4)

A player tracks their statistics (races, wins, items used, distance driven), unlocks 2 hidden characters by completing specific conditions, unlocks alternative kart color skins, and views best times per circuit.

**Why this priority**: Progression gives long-term motivation but the game is fully playable without it. This is a polish layer.

**Independent Test**: Can be tested by completing achievement conditions and verifying unlocks appear, and checking that stats persist across sessions.

**Acceptance Scenarios**:

1. **Given** the player finishes 1st with all 8 base characters, **When** the condition is met, **Then** a hidden character is unlocked with a notification and becomes selectable.
2. **Given** the player sets a new best time on a circuit, **When** the race ends, **Then** the record is saved and visible on the circuit selection screen.

---

### Edge Cases

- What happens when a player disconnects mid-race in online multiplayer and reconnects after the 10-second grace period? (They are removed from the race and placed as spectator.)
- How does the game handle a browser tab losing focus during a race? (Game pauses in solo; in multiplayer, the kart auto-drives using basic AI to prevent blocking.)
- What happens if all item crates are depleted simultaneously by multiple players? (Crates respawn on a timer, typically 10-15 seconds.)
- How does the game behave when a mobile device has insufficient GPU capabilities? (Graceful degradation with further reduced settings; if below minimum threshold, a warning message is shown.)
- What happens if the online room host disconnects? (Host migration to the next player in the room; if no players remain, room is destroyed.)
- How does split-screen handle extreme performance drops? (Dynamic resolution scaling per viewport to maintain target frame rate.)
- What happens when two players pick the same character in multiplayer? (Allowed, with alternate color skin applied automatically to the duplicate.)
- How does the legendary item (Eye of KHAOS) interact with crew mode? (It affects all enemy karts including both driver and gunner of enemy crew karts.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render all game elements using a cell shading visual style with discrete light levels (3-4 steps, no gradients), thick black outlines on all objects, and stylized square shadows.
- **FR-002**: System MUST provide 8 playable characters, each with unique stats (Speed, Acceleration, Handling, Weight, Special) totaling exactly 25 points, a unique kart with distinct physics behavior, a signature weapon, and a passive ability.
- **FR-003**: System MUST provide 5 themed circuits, each with distinct elevation profiles, at least 2 shortcuts (with varying access conditions: universal, item-gated, or character-gated), dynamic environmental hazards, and weather events that affect gameplay.
- **FR-004**: System MUST implement a complete item system with 16 distinct items across 4 categories (offensive, defensive, movement, track) plus 1 legendary item and 8 character-specific signature weapons, all distributed via track crates with position-based probability weighting (rubber-banding on items, never on speed). Signature weapons replace a generic item roll when drawn and follow the same probability rules.
- **FR-005**: System MUST provide AI opponents with waypoint-based pathfinding, 3 difficulty levels (Novice, Normal, Expert), personality-based driving styles per character, and difficulty rubber-banding capped at +15% speed.
- **FR-006**: System MUST support local split-screen multiplayer for 2-4 players with configurable screen orientation (horizontal/vertical for 2 players, quadrants for 4).
- **FR-007**: System MUST support an asymmetric crew mode where 2 players share one kart: a driver with 3rd-person view controlling movement, and a gunner with FPS view controlling an independently-aimed turret. Each role has a separate item slot: the driver collects from standard track crates, and the gunner collects from dedicated turret ammo crates placed on the track. Both can hold and use one item independently.
- **FR-008**: System MUST support online multiplayer rooms for up to 8 players, with public/private rooms (6-digit code), host-configurable settings, lobby text chat, spectator mode, and automatic reconnection within a 10-second grace period.
- **FR-009**: System MUST support keyboard controls (with AZERTY defaults for Player 1 and numpad for Player 2), gamepad controls (Xbox, PS, Switch Pro auto-detection), and mobile touch controls (virtual joystick, buttons, optional gyroscope).
- **FR-010**: System MUST allow full control remapping for all input methods, with per-player key bindings persisted across sessions.
- **FR-011**: System MUST provide a comprehensive pause menu with settings for controls, audio (per-category volume sliders, spatial audio toggle), video (quality presets, individual toggles), gameplay (steering assist, minimap, language selection), and accessibility (text size, colorblind modes, strobe reduction).
- **FR-012**: System MUST implement dynamic weather per circuit that affects both visuals (particle effects, surface shaders, visibility) and gameplay (grip modifiers ranging from -15% to -60%, visibility reduction, environmental EMP zones).
- **FR-013**: System MUST implement a dynamic sky system with procedural day/night cycle, animated clouds, and weather-appropriate atmospheric effects.
- **FR-014**: System MUST support Time Trial mode with local ghost recording/playback and Grand Prix mode with 4-circuit series and points-based standings.
- **FR-015**: System MUST implement a dynamic audio system with context-sensitive music stems (bass, drums, melody, tension layers activated by race position and lap), speed-based engine sound synthesis, and 3D positional audio for nearby karts.
- **FR-016**: System MUST support mobile play with forced landscape orientation, adaptive HUD layout, automatic low-quality profile detection, and PWA installation capability.
- **FR-017**: System MUST persist player data locally including best times per circuit, statistics (races, wins, items used, distance), unlocked characters, and unlocked skins.
- **FR-018**: System MUST provide 2 unlockable hidden characters and 3 alternative color skins per kart, gated behind specific gameplay conditions.
- **FR-019**: The Ruins of Khaos circuit MUST change a section of its layout between laps via portal activation/deactivation, creating a different racing path each lap.
- **FR-020**: System MUST provide a suite of automated end-to-end tests covering menu navigation, game controls, item system, local multiplayer, online multiplayer, pause menu, performance benchmarks, and mobile controls.

### Key Entities

- **Character**: Name, stats (5 attributes totaling 25), kart visual design, kart physics model, signature weapon (name, effect, duration, cooldown), passive ability (name, effect, conditions), unlock status.
- **Circuit**: Name, theme, elevation profile, waypoint path, shortcut definitions (location, access condition, time saved), weather event pool (type, gameplay effects, duration), dynamic hazard definitions, item crate spawn positions, lap count.
- **Item**: Name, category (offensive/defensive/movement/track/legendary/signature), effect description, duration, area of effect, position-probability weighting curve. Players hold at most one item at a time.
- **Race**: Mode (solo/time-trial/grand-prix/local-multi/online-multi), circuit, lap count, weather setting, item toggle, crew mode toggle, participant list, current standings, timer.
- **Room**: Room ID, access type (public/private), 6-digit code, host player, settings (circuit, laps, weather, items, crew mode), player list (max 8), chat messages, state (lobby/in-race/finished).
- **Player Profile**: Best times per circuit, total races, wins, items used, distance traveled, unlocked characters, unlocked skins, settings preferences.
- **Ghost Replay**: Circuit ID, character ID, frame-by-frame position/rotation data, total time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desktop players experience smooth gameplay at 60 frames per second under normal race conditions (8 karts, items active, weather active).
- **SC-002**: Mobile players on mid-range devices (2020+ smartphones) experience stable gameplay at 30 frames per second with the automatic low-quality profile.
- **SC-003**: The game loads and becomes playable within 8 seconds on a standard broadband connection.
- **SC-004**: Players can complete character selection, circuit selection, and start a race within 30 seconds from the main menu.
- **SC-005**: Online multiplayer position synchronization shows no perceptible desync between players (less than 100ms perceived lag with interpolation).
- **SC-006**: All 8 characters feel mechanically distinct, with measurable differences in lap times across circuits of at least 5% between the fastest and slowest character archetypes.
- **SC-007**: Each circuit offers at least 2 viable racing strategies (main path vs shortcuts) with time tradeoffs, validated by AI completing circuits via different routes.
- **SC-008**: The item rubber-banding system enables comeback potential: a player in last place can reach the podium (top 3) using items effectively within 2 laps on a 3-lap race.
- **SC-009**: Crew mode gunner can aim and fire independently from driver direction with no input latency or aiming restrictions beyond the turret rotation range.
- **SC-010**: All automated E2E tests pass on Desktop Chrome, Desktop Firefox, iPhone (simulated), and Samsung Galaxy (simulated) profiles.
- **SC-011**: The game is installable as a PWA on mobile devices and functions offline for single-player modes after initial load.

## Clarifications

### Session 2026-03-07

- Q: How do players acquire their character's signature weapon? → A: Signature weapons appear as character-specific drops from item crates (replaces a generic item roll), with the same position-based probability weighting as other items.
- Q: How many items can a player hold at once? → A: One item at a time. Players must use or discard their current item before collecting another from a crate.
- Q: In crew mode, how do the driver and gunner interact with items? → A: Each role has a separate item slot. The driver picks up items from standard track crates. The gunner has dedicated turret ammo crates on the track. Both can hold and use one item independently.

## Assumptions

- **A-001**: Characters and karts will use procedurally generated or primitive-based 3D models with cell shading, not hand-crafted high-poly assets. The cell shading style allows for simpler geometry to still look visually appealing.
- **A-002**: Audio assets (music stems, sound effects, voice lines) will be synthesized or use placeholder assets initially, with the system architecture supporting easy replacement.
- **A-003**: The AZERTY keyboard layout is the default for Player 1 (Z/Q/S/D), reflecting the user's French locale. WASD alternative will be available via remapping.
- **A-004**: The game server for online multiplayer is a lightweight process that players can self-host or that runs on a single server instance. No matchmaking service or persistent backend database is required.
- **A-005**: localStorage is sufficient for player data persistence (records, stats, unlocks, settings). No cloud save or account system is required.
- **A-006**: The 2 hidden unlockable characters will have their full design (stats, abilities, karts) defined during the planning phase. The spec defines the unlock mechanism but not the character details.
- **A-007**: Circuit item crate placement, shortcut timing values, and weather event durations are tuning parameters that will be refined during playtesting, not fixed at specification time.
