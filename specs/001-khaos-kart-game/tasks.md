# Tasks: KHAOS KART

**Input**: Design documents from `/specs/001-khaos-kart-game/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/network-protocol.md

**Tests**: E2E tests are explicitly required (FR-020). Test tasks are included in the final testing phase.

**Organization**: Tasks grouped by user story. US1/US2/US3 are all P1 but separated for incremental delivery: US1 = playable race with basic everything, US2 = character depth, US3 = circuit depth.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization, dependencies, build tooling

- [x] T001 Initialize Vite project with `npm create vite@latest` at repository root, configure vite.config.js with WASM support for Rapier.js and GLSL import plugin
- [x] T002 Install dependencies: three, @dimforge/rapier3d-compat, socket.io-client, howler, nipplejs, vite-plugin-pwa in package.json
- [x] T003 [P] Create index.html with fullscreen canvas element and CSS reset (no scrollbars, 100vw/100vh, touch-action none)
- [x] T004 [P] Create src/main.js with basic game loop skeleton (requestAnimationFrame, delta time calculation, state machine for scenes: menu/race/results)
- [x] T005 [P] Create server/package.json with socket.io, express dependencies and server/index.js with basic Socket.io server on port 3000
- [x] T006 [P] Add npm scripts in package.json: dev, build, preview, server:dev (nodemon), server:start, test:e2e

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core engine systems that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Create toon vertex shader in src/shaders/toon.vert.glsl with inverted hull outline pass (backface scaling along normals, configurable outline width uniform)
- [x] T008 Create toon fragment shader in src/shaders/toon.frag.glsl with 3-step lighting (smoothstep quantization), Blinn-Phong specular cutoff, rim lighting, shadow map integration, per-circuit color palette uniform
- [x] T009 Implement src/engine/Renderer.js: Three.js WebGLRenderer setup, single directional light with 2048x2048 shadow map, scene/camera creation, toon ShaderMaterial factory method, render loop with viewport/scissor support for future split-screen, FPS counter toggle, quality presets (low/medium/high/ultra affecting shadow resolution and pixel ratio)
- [x] T010 Implement src/engine/Physics.js: Rapier.js WASM initialization, world creation with gravity, helper methods for creating kinematic rigid bodies, static colliders (track walls), raycasting (ground detection, surface type), collision event system with callbacks
- [x] T011 Implement src/engine/InputManager.js: keyboard input with AZERTY defaults for Player 1 (Z/Q/S/D/Space/F/R/T) and numpad for Player 2, key state tracking (pressed/held/released), configurable key bindings with per-player mapping, persist bindings to localStorage
- [x] T012 Implement src/engine/AudioEngine.js: Howler.js initialization, SFX playback with pooling, music stem system (load 4 AudioBuffers per track, shared GainNodes per stem, synchronized start via audioContext.currentTime, linearRampToValueAtTime for crossfades), engine sound synthesis (looping sample with playbackRate modulation based on speed input)
- [x] T013 Implement src/utils/Storage.js: localStorage wrapper with JSON serialization for PlayerProfile, Settings, GhostReplay entities from data-model.md, versioned schema with migration support
- [x] T014 Implement src/utils/QualityDetector.js: detect hardwareConcurrency, touch capability, screen size, return quality profile (low/medium/high), runtime FPS monitoring with auto-downgrade if sustained below 30fps

**Checkpoint**: Engine foundation ready - game loop renders a toon-shaded test object, physics raycasts work, keyboard input is captured, audio plays a test sound

---

## Phase 3: User Story 1 - Solo Race Against AI (Priority: P1) MVP

**Goal**: One playable race on one circuit with 8 karts (1 human + 7 AI), basic items, basic HUD, countdown, results screen

**Independent Test**: Launch the game, pick a character, pick a circuit, race 3 laps against AI, use items, see results

### Implementation for User Story 1

- [x] T015 [P] [US1] Create src/characters/index.js: character registry with all 8 base characters (id, name, stats array [speed/accel/handling/weight/special summing to 25], kartPhysicsType, placeholder signatureWeapon and passive references) per data-model.md Character entity
- [x] T016 [P] [US1] Create src/circuits/index.js: circuit registry. Create src/circuits/VolcanPeak.js: procedural track generation using Three.js TubeGeometry or ExtrudePath for a loop circuit with elevation changes (spiral ascent, descent), define waypoint array (Vector3[]), startGrid positions (8 slots), item crate spawn positions (15-20 per lap), default 3 laps
- [x] T017 [P] [US1] Create src/game/KartController.js: custom arcade kart movement — circle-based steering (turn radius = f(speed, handling stat)), acceleration/deceleration curves with max speed from character stats, drag proportional to speed, gravity via Rapier raycast ground detection, surface friction modifier, basic drift state machine (press drift button → tighter turn radius, accumulate drift time for 3 boost tiers, release → boost), collision response via Rapier kinematic body + collision events applying knockback impulse scaled by weight stat difference
- [x] T018 [US1] Create src/game/RaceManager.js: race lifecycle state machine (countdown 3-2-1-go → racing → finished), lap tracking via checkpoint/waypoint system (track progress 0.0-1.0 per lap using nearest waypoint), standings calculation (sort by laps completed then lap progress), race timer, finish detection on final lap crossing start line, store Race entity state per data-model.md
- [x] T019 [US1] Create src/game/AIController.js: waypoint-following steering behavior (seek next waypoint, avoid walls via short raycasts), speed management (brake before tight turns based on turn angle), 3 difficulty levels: Novice (wide racing line, random braking, ignores items), Normal (follows racing line, uses items with delay), Expert (optimal racing line, immediate item use). Single difficulty selected per race. Rubberbanding: if human player >5s ahead, AI gains up to +15% max speed
- [x] T020 [US1] Create src/game/ItemSystem.js: ItemCrate class (rotating toon-shaded box mesh at spawn positions, respawn after 12s when collected), item pool with all 16 generic items + 1 legendary from data-model.md Item entity, position-based probability weighting (position 1: mostly defensive/weak, position 8: mostly offensive/strong), item pickup collision detection, item slot (one per kart, hold one item). Implement 5 starter item effects: Boost Nitro (3s speed multiply), Orbe de Choc (homing projectile forward), Mine Magnetique (drop behind, explode on proximity), Bouclier Orbital (absorb one hit), Nappe de Gel (drop slippery zone). Remaining items as stubs returning a console log
- [x] T021 [US1] Create src/ui/MainMenu.js: HTML/CSS overlay on canvas — game title "KHAOS KART", buttons for Solo Race, Time Trial (disabled initially), Grand Prix (disabled), Local Multiplayer (disabled), Online (disabled). Solo Race button → character select flow
- [x] T022 [US1] Create src/ui/CharacterSelect.js: HTML/CSS grid showing 8 characters with name, stat bars (5 bars out of 10), kart preview (rotating 3D model in small viewport). Click to select → circuit select
- [x] T023 [US1] Create src/ui/CircuitSelect.js: HTML/CSS list of circuits (initially just Volcan Peak) with name, theme, preview image placeholder. Click to select → start race
- [x] T024 [US1] Create src/ui/HUD.js: HTML/CSS overlay showing: current position (1st-8th), lap counter (e.g., 2/3), race timer, current speed, held item icon (or empty slot), minimap (2D canvas drawing track outline + kart dots)
- [x] T025 [US1] Create src/ui/ResultsScreen.js: HTML/CSS showing final standings (position, character name, time), "Restart" and "Menu" buttons
- [x] T026 [US1] Integrate all US1 systems in src/main.js: scene flow (MainMenu → CharacterSelect → CircuitSelect → Race scene with Renderer + Physics + KartController + AIController + ItemSystem + RaceManager + HUD → ResultsScreen → MainMenu), create 8 kart meshes (procedural box-based kart with toon shader, colored per character), attach kinematic Rapier bodies, run game loop updating all systems per frame
- [x] T027 [US1] Create procedural kart mesh generator in src/engine/Renderer.js: basic kart shape from BoxGeometry + CylinderGeometry wheels, apply toon ShaderMaterial with character color, attach inverted hull outline. Create procedural track visuals for VolcanPeak: TubeGeometry track surface with lava-orange toon palette, simple barrier meshes on sides, basic skybox with solid color gradient

**Checkpoint**: A complete solo race is playable — select Rico, race Volcan Peak for 3 laps against 7 AI, pick up items, use Boost/Orbe/Mine/Bouclier/Gel, see standings update live, finish and see results. This is the MVP.

---

## Phase 4: User Story 2 - Character Differentiation (Priority: P1)

**Goal**: All 8 characters feel mechanically distinct with unique passives, signature weapons, and physics behaviors

**Independent Test**: Play as each character and verify: different driving feel, passive activates correctly, signature weapon has unique effect

### Implementation for User Story 2

- [x] T028 [P] [US2] Create src/characters/Rico.js: passive (drift charge rate ×1.2 modifier on KartController drift timer), signature weapon Grapplin'Boost (homing grapple projectile to nearest kart ahead, pull target back + boost Rico forward)
- [x] T029 [P] [US2] Create src/characters/Zyrx.js: kartPhysicsType "levitating" (hover height offset, slight lateral drift in straights, no wheel contact visual), passive (immune to mud/ice grip penalties — skip surface friction modifier), signature weapon Mind Spike (reverse steering input for 3 nearest opponents for 4s)
- [x] T030 [P] [US2] Create src/characters/Krogash.js: kartPhysicsType "tracked" (wider collision box, slower turn animation), passive (on side collision, push lighter karts away — compare weight stats, apply impulse if own weight > other), signature weapon Charge Cornue (5s forced straight-line at 2x speed, destroy anything on contact, immune to all damage)
- [x] T031 [P] [US2] Create src/characters/D4sh.js: passive (item crate collection triggers 2x faster respawn for D4sh's next crate), signature weapon Overclock (2x speed and accel for 5s, then forced 2s slowdown to 30% speed)
- [x] T032 [P] [US2] Create src/characters/Vermox.js: balanced stats (all 4s), passive (in rain weather, hide from minimap when flames active), signature weapon Napalm Trail (3s fire trail behind kart, damages and slows karts that drive through)
- [x] T033 [P] [US2] Create src/characters/Sylvara.js: kartPhysicsType "hybrid" (front wheels only, drift-assisted turning — auto-correct oversteer), passive (small obstacles <1m don't cause collision slowdown), signature weapon Hex Clone (spawn 2 AI-driven decoy karts for 6s that explode on contact)
- [x] T034 [P] [US2] Create src/characters/Sharko.js: passive (in water/mud track sections, gain +20% speed instead of penalty), signature weapon Sonar Pulse (reveal all hidden items on minimap for 8s, show all opponent positions to teammates)
- [x] T035 [P] [US2] Create src/characters/GrootX.js: passive (if no damage taken for 10s, gain +10% handling; reset on hit), signature weapon Root Trap (place 3 root trap meshes on track, persist 15s, immobilize karts for 2s on contact)
- [x] T036 [US2] Update src/game/KartController.js: integrate character-specific physics types (levitating hover offset for Zyrx, tracked wider collision for Krogash, hybrid drift-assist for Sylvara), apply passive modifiers each frame based on character.passive.effectModifiers, add surface-type detection via Physics.js raycast returning material ID
- [x] T037 [US2] Update src/game/ItemSystem.js: add signature weapon to crate roll table as character-specific drop (when rolled, replace with that character's weapon), implement all 8 signature weapon effects calling each character module, implement remaining generic items: Salve de Debris (3 spread projectiles), Onde EMP (disable nearby karts 2s), Traqueur de Rang (homes on 1st place), Cloak (invisible on minimap 8s), Leurre Holographique (decoy kart), Levitateur (5m jump), Teleporteur (warp 3 positions ahead), Phase Ghost (no-clip 4s), Mur Temporaire (solid wall 5s), Faux Bonus (fake crate, explodes), Pluie d'Asteroides (5 random impacts on top 3), L'Oeil de KHAOS (30% speed for all enemies 10s)
- [x] T038 [US2] Update src/ui/CharacterSelect.js: show signature weapon name/description and passive description per character, animate stat bars on hover, show kart physics type icon

**Checkpoint**: All 8 characters play differently — Zyrx floats over ice, Krogash bulldozes light karts, Rico drifts charge faster, all signature weapons work with unique effects

---

## Phase 5: User Story 3 - Circuit Variety (Priority: P1)

**Goal**: All 5 circuits playable with shortcuts, dynamic hazards, and weather system

**Independent Test**: Race each circuit, verify 2+ shortcuts work (with correct access conditions), weather events trigger and affect gameplay, dynamic hazards appear

### Implementation for User Story 3

- [x] T039 [P] [US3] Create src/circuits/NeonCity.js: cyberpunk night circuit with elevation changes via ramps, shortcut 1 (fan-timed boost, universal access), shortcut 2 (rooftop via Levitateur/Zyrx only), hazard definitions (AI traffic vehicles crossing track periodically), weather pool (acid rain -30% grip, blackout removes lighting 10s)
- [x] T040 [P] [US3] Create src/circuits/CrystalForest.js: enchanted forest with sinuous path, shortcut 1 (frozen river, universal, low grip), shortcut 2 (crystal tunnel, requires Crystal Breaker item), hazard definitions (none — crystal light reflections as visual-only), weather pool (blizzard -60% grip 45s, crystal rain minor damage)
- [x] T041 [P] [US3] Create src/circuits/AbyssalReef.js: underwater themed with current zones pushing karts, shortcut 1 (fast current — Sharko accelerates, others slow), shortcut 2 (whale back, periodic, requires grapple or perfect jump), hazard definitions (air bubbles as trampolines), weather pool (underwater storm strong currents, bioluminescence hides items 15s)
- [x] T042 [P] [US3] Create src/circuits/RuinsOfKhaos.js: floating ruins with gravity-inverted sections (kart sticks to ceiling via modified gravity raycast), portal-based layout mutations (section A/B toggled per lap via mutatesPerLap flag), shortcut 1 (teleport portal, random exit among 3 points), shortcut 2 (floating platform, timed jump), weather pool (dimensional storm randomizes items, gravity shift increases jump height 20s)
- [x] T043 [US3] Update src/circuits/VolcanPeak.js: add shortcut 1 (geyser jump, requires Levitateur or Sylvara), shortcut 2 (hidden lava tunnel, always accessible but degrades speed), hazard definitions (falling rock obstacles spawning randomly every 8-15s), weather pool (ash rain -15% grip -20% visibility 30s, eruption blocks section with lava zone)
- [x] T044 [US3] Create src/game/WeatherSystem.js: weather event scheduler (random trigger every 60-120s from circuit's weather pool, duration per event), visual effects per weather type (rain: particle system of streak sprites + wet surface specular boost; blizzard: 3D snow particles + snow accumulation texture blend on karts; ash: dark slow particles + blur post-effect; electric storm: random flash lights + EMP zone every 15s), gameplay modifiers (gripModifier applied to KartController surface friction, visibilityModifier applied to fog/camera range)
- [x] T045 [US3] Implement shortcut system in src/game/RaceManager.js: shortcut trigger zones (box colliders at entry points), access condition check (universal: always pass; item-gated: check player has required item, consume it; character-gated: check character ID), shortcut path (teleport or alternate waypoint sequence), update lap progress calculation to handle shortcut paths
- [x] T046 [US3] Implement dynamic hazards in src/game/RaceManager.js: hazard spawner per circuit definition (falling rocks for Volcan, traffic for NeonCity, currents for Abyssal, portal mutations for Ruins), collision with hazards applies damage/slowdown, Ruins of Khaos lap mutation logic (toggle active portal each lap changing track section geometry)
- [x] T047 [US3] Create procedural sky shader in src/shaders/sky.frag.glsl: gradient-based sky with configurable horizon/zenith colors per circuit theme, animated cloud billboards (2D sprite sheets with movement), day/night cycle based on race duration, weather overlay (darken for storms, orange for ash)
- [x] T048 [US3] Update src/ui/CircuitSelect.js: show all 5 circuits with theme description, elevation icon, weather types, shortcut count

**Checkpoint**: All 5 circuits fully playable with unique themes, working shortcuts (some requiring items or specific characters), dynamic weather changing grip/visibility, falling rocks on Volcan, traffic on NeonCity, Ruins layout changing per lap

---

## Phase 6: User Story 4 - Local Split-Screen (Priority: P2)

**Goal**: 2-4 players race together on same screen with independent controls and viewports

**Independent Test**: Start 2-player local game, both players steer independently on split viewports, complete a race

### Implementation for User Story 4

- [x] T049 [US4] Update src/engine/Renderer.js: split-screen rendering via setViewport/setScissor per player camera (2-player: horizontal or vertical split configurable; 4-player: quadrants), set autoClear false, manual clear once per frame, calculate per-viewport aspect ratio for PerspectiveCamera, render scene N times with N cameras
- [x] T050 [US4] Update src/engine/InputManager.js: multi-player input support — Player 1 AZERTY + Player 2 numpad active simultaneously, Player 3/4 via additional key zones or gamepads, each player gets independent input state object, add Gamepad API polling (navigator.getGamepads) with Xbox/PS/Switch Pro detection and default mapping
- [x] T051 [US4] Update src/ui/MainMenu.js: enable "Local Multiplayer" button, add player count selector (2/3/4), each player selects character independently on CharacterSelect (split into columns per player)
- [x] T052 [US4] Update src/main.js and src/game/RaceManager.js: support multiple human players — create N player KartControllers each linked to a separate InputManager player slot and camera, HUD rendered per viewport (position/lap/item for each player), pause pauses all players

**Checkpoint**: 2-4 players can race together on split-screen with independent controls, each sees their own viewport and HUD

---

## Phase 7: User Story 5 - Crew Mode (Priority: P2)

**Goal**: 2 players share one kart — driver steers, gunner aims/fires turret independently

**Independent Test**: Start crew mode, driver steers the kart, gunner rotates turret independently and fires items from turret direction

### Implementation for User Story 5

- [x] T053 [US5] Create src/game/TurretController.js: FPS-style turret attached to kart rear, independent yaw/pitch rotation controlled by gunner input (mouse or IJKL keys for Player 2), aim reticle rendering in gunner viewport, fire button triggers item use from turret world-space direction (not kart forward), turret rotation range limits (±120 degrees yaw, ±30 degrees pitch)
- [x] T054 [US5] Update src/game/ItemSystem.js: add turret ammo crate type (distinct mesh, placed at turretCrateSpawns from circuit data), separate item slot for gunner (driver collects standard crates → driver slot, kart drives over turret crate → gunner slot), item projectile spawn from turret position/direction when gunner fires
- [x] T055 [US5] Update src/engine/Renderer.js: crew mode viewport layout — driver gets 3rd-person chase camera (left viewport), gunner gets FPS camera attached to turret position/rotation (right viewport), render scene twice with these two cameras
- [x] T056 [US5] Update src/ui/MainMenu.js: add crew mode toggle to local multiplayer setup, update CharacterSelect to show single kart selection with Driver/Gunner role assignment, update HUD to show two item slots (driver + gunner) in crew viewports

**Checkpoint**: Crew mode works — driver steers kart, gunner aims independently and fires items from turret, both have their own viewport and item slot

---

## Phase 8: User Story 9 - Pause Menu & Settings (Priority: P2)

**Goal**: Full pause menu with settings for controls, audio, video, gameplay, and accessibility

**Independent Test**: Press Escape during race, navigate all settings sections, change a key binding, change video quality, verify changes persist after resume

### Implementation for User Story 9

- [x] T057 [P] [US9] Create src/ui/PauseMenu.js: HTML/CSS glassmorphism overlay (dark semi-transparent backdrop with blur), slide-in animation from bottom, accordion sections for Controls/Audio/Video/Game/Accessibility, "Resume" button with pulsation CSS animation, "Restart Race" and "Return to Menu" buttons, open on Escape key (or mobile pause button), pause game loop on open, resume on close
- [x] T058 [P] [US9] Implement Controls settings section in src/ui/PauseMenu.js: display current key mappings per player in a table (action → key), click action to enter remap mode (listen for next keypress, assign, save to InputManager), gamepad dead zone slider and sensitivity slider, gyroscope sensitivity slider (mobile only)
- [x] T059 [P] [US9] Implement Audio settings section in src/ui/PauseMenu.js: custom CSS sliders with numeric readout for master volume, music volume, SFX volume, engine volume (each updating AudioEngine gain nodes in real-time), music mode dropdown (Dynamic/Chill/Off), spatial audio toggle
- [x] T060 [P] [US9] Implement Video settings section in src/ui/PauseMenu.js: quality preset dropdown (Low/Medium/High/Ultra) auto-configuring sub-settings, render resolution slider (50%/75%/100%/150% updating Renderer pixel ratio), individual toggles for shadows, particles, weather effects, reflections, post-processing (Off/Cell-Shading only/Full), V-Sync toggle, FPS counter toggle
- [x] T061 [P] [US9] Implement Game settings section in src/ui/PauseMenu.js: steering assist dropdown (Off/Light/Strong — applies auto-correction in KartController), track direction indicators toggle, minimap size (Off/Small/Large), opponent stats display toggle, split-screen orientation (Horizontal/Vertical), language selector (FR/EN/ES/DE/JP — stores locale, applies to all UI strings)
- [x] T062 [P] [US9] Implement Accessibility settings in src/ui/PauseMenu.js: text size selector (Normal/Large/Very Large — applies CSS font-size scale), colorblind mode (Off/Deuteranopia/Protanopia — applies CSS filter or shader uniform swap), reduce strobe effects toggle (disables lightning flashes, explosion flashes)
- [x] T063 [US9] Integrate PauseMenu with game systems: save all settings to localStorage via Storage.js on change, load settings on game start and apply to Renderer/AudioEngine/InputManager/KartController, verify persistence across page reload

**Checkpoint**: Pause menu fully functional — all settings categories work, key remapping works, quality changes apply in real-time, settings persist across sessions

---

## Phase 9: User Story 6 - Online Multiplayer (Priority: P3)

**Goal**: Players create/join rooms, race together online with synced state

**Independent Test**: Create a room, second browser tab joins via code, both players see each other in lobby and complete a synchronized race

### Implementation for User Story 6

- [x] T064 [P] [US6] Implement server/RoomManager.js: room creation (generate 6-digit code, store RoomSettings), join by code (validate, add player, broadcast), leave/disconnect handling, room state machine (lobby → starting → in-race → results), host privileges (configure settings, start race), player ready system, dispose room when empty after 30s
- [x] T065 [P] [US6] Implement server/PlayerSession.js: connection tracking per socket, reconnection token generation on join (crypto.randomUUID), 10s grace period timer on disconnect (retain slot, kart on autopilot AI), reconnect validation (match token, restore slot, send full snapshot), token invalidation on grace expiry
- [x] T066 [US6] Implement server/GameSimulation.js: server-side game tick at 20Hz (setInterval 50ms), receive player inputs (steering, throttle, brake, drift, useItem), run simplified KartController physics per tick (same arcade model as client), resolve collisions, track standings/laps, broadcast delta-compressed state snapshots per network-protocol.md contract, handle item pickups and effects server-side (authoritative), emit race events (lap complete, item hit, finish)
- [x] T067 [US6] Create src/network/NetworkClient.js: Socket.io client wrapper, emit player:input at 60Hz, emit room:create/join/ready/select-character/chat/start per contract, receive and dispatch race:snapshot/event/standings/results and room:* events, connection state management (connecting/connected/disconnected/reconnecting)
- [x] T068 [US6] Create src/network/Interpolation.js: 100ms interpolation buffer for remote karts, store last 3 snapshots per participant, hermite spline interpolation between snapshots using position + velocity, handle missing snapshots (extrapolate using last velocity for up to 100ms then freeze)
- [x] T069 [US6] Create src/network/Prediction.js: client-side prediction for local kart (apply inputs immediately, store in circular buffer keyed by tick), server reconciliation (on snapshot arrival, compare predicted state for that tick, if different: snap to server state and re-simulate all buffered inputs from that tick forward), visual smoothing for small corrections (blend over 100-200ms)
- [x] T070 [US6] Create src/ui/LobbyUI.js: HTML/CSS room creation form (public/private toggle, settings: circuit/laps/weather/items/crew mode), room code display, join form (enter 6-digit code), player list with character selection, ready toggle per player, text chat input and message list (max 200 chars), host "Start Race" button (enabled when all ready)
- [x] T071 [US6] Update src/main.js: online multiplayer scene flow (MainMenu → LobbyUI → Race with NetworkClient managing state instead of local AI → ResultsScreen), spawn remote karts using Interpolation.js positions, disable local AI for human-controlled remote karts, spectator camera mode after race finish or after disconnect grace expiry
- [x] T072 [US6] Update server/index.js: integrate RoomManager, PlayerSession, GameSimulation, Socket.io event routing (room:* → RoomManager, player:input/gunner:input → GameSimulation)

**Checkpoint**: Online multiplayer works — create room, share code, second player joins, lobby chat works, race starts synchronized, karts move smoothly via interpolation, reconnection works within 10s

---

## Phase 10: User Story 7 - Mobile Controls (Priority: P3)

**Goal**: Game playable on mobile with touch joystick, adaptive HUD, auto quality, PWA install

**Independent Test**: Open game on mobile, landscape orientation enforced, virtual joystick steers, buttons accelerate/brake/use item, performance stays smooth

### Implementation for User Story 7

- [x] T073 [P] [US7] Update src/engine/InputManager.js: integrate nipple.js virtual joystick (left side of screen, "semi" mode — appears at touch point), map joystick angle to steering (-1 to 1) and force to throttle (0 to 1), add touch buttons for brake, item use, drift, and look-behind (right side of screen), add optional gyroscope input via DeviceOrientation API (gamma axis for steering, requestPermission on iOS, dead zone ±8 degrees, low-pass filter)
- [x] T074 [P] [US7] Update src/ui/HUD.js: responsive layout that adapts to mobile viewport (larger touch targets, minimap in corner away from joystick zone, item slot centered top, standings compact), add portrait mode detection with "Rotate to landscape" overlay message
- [x] T075 [US7] Configure PWA in vite.config.js: add vite-plugin-pwa with registerType 'prompt', manifest (name "KHAOS KART", display "fullscreen", orientation "landscape", icons 192/512), workbox precache for game shell (JS/CSS/HTML), runtime CacheFirst for assets/ (models, textures, audio), create update notification banner between races
- [x] T076 [US7] Update src/main.js: on startup run QualityDetector, if mobile detected auto-apply Low quality profile (shadows off, particles reduced, render resolution 75%), enable touch input mode in InputManager, vibration feedback via navigator.vibrate on item hit and collision

**Checkpoint**: Game fully playable on mobile — touch controls work, HUD is readable, performance is smooth on mid-range devices, PWA installable

---

## Phase 11: User Story 8 - Time Trial & Grand Prix (Priority: P3)

**Goal**: Time Trial with ghost recording/playback and Grand Prix with 4-circuit points-based series

**Independent Test**: Complete a time trial, see ghost on next attempt. Complete a 4-circuit Grand Prix, see cumulative standings

### Implementation for User Story 8

- [x] T077 [P] [US8] Implement Time Trial mode in src/game/RaceManager.js: solo race (no AI, no items), record GhostReplay per data-model.md (capture position + yaw every 100ms into GhostFrame array), save best ghost to localStorage via Storage.js keyed by circuitId + characterId, load and spawn ghost kart mesh (semi-transparent toon material) playing back recorded frames with time interpolation
- [x] T078 [P] [US8] Implement Grand Prix mode in src/game/RaceManager.js: series of 4 circuits (configurable selection), points system per race (1st=15, 2nd=12, 3rd=10, 4th=8, 5th=6, 6th=4, 7th=2, 8th=1), cumulative standings across races, transition between circuits with intermediate standings screen, final Grand Prix champion screen
- [x] T079 [US8] Update src/ui/MainMenu.js: enable Time Trial and Grand Prix buttons, add Grand Prix circuit selection UI (pick 4 from 5), add Time Trial circuit picker showing best time per circuit from PlayerProfile

**Checkpoint**: Time Trial records ghosts and replays them, Grand Prix tracks points across 4 races and shows champion

---

## Phase 12: User Story 10 - Progression & Unlockables (Priority: P4)

**Goal**: Statistics tracking, 2 hidden characters, 3 alt skins per kart, best times display

**Independent Test**: Play multiple races, verify stats accumulate. Complete unlock condition, verify hidden character appears

### Implementation for User Story 10

- [x] T080 [P] [US10] Update src/game/RaceManager.js: after each race, update PlayerProfile via Storage.js (increment totalRaces, totalWins if 1st, totalItemsUsed from race counter, add distance from race, update bestTimes if new record)
- [x] T081 [P] [US10] Implement unlock system in src/characters/index.js: define 2 hidden characters (id, stats, weapons, passives — design per A-006 assumption, e.g., "CHAOS" all stats 5/5/5/5/5 and "GLITCH" extreme 10/1/1/10/3), define unlock conditions (hidden char 1: finish 1st with all 8 base characters; hidden char 2: complete all 5 circuits in Grand Prix mode with gold time), check conditions after each race, show unlock notification in ResultsScreen
- [x] T082 [P] [US10] Implement skin system in src/characters/index.js: 3 alternative color palettes per character (define RGB primary/secondary/accent per skin), unlock conditions (skin 1: win 3 races with character, skin 2: win on each circuit with character, skin 3: complete Grand Prix 1st with character), add skin selector to CharacterSelect UI
- [x] T083 [US10] Create statistics display: add "Stats" button to MainMenu, show PlayerProfile data (total races, wins, win rate, items used, distance, best times table), show unlocked/locked characters and skins with progress indicators

**Checkpoint**: Stats track across sessions, hidden characters unlock when conditions met, skins unlock and are selectable

---

## Phase 13: E2E Tests (FR-020)

**Purpose**: Automated test suite per spec requirement FR-020

- [x] T084 [P] Create tests/e2e/playwright.config.js: projects for Desktop Chrome, Desktop Firefox, iPhone 14, Samsung Galaxy S21 profiles, webServer command 'npm run dev' port 5173
- [x] T085 [P] Create tests/e2e/01-menu-navigation.spec.js: load game, verify main menu renders, navigate to character select, select a character, navigate to circuit select, select circuit, verify race starts
- [x] T086 [P] Create tests/e2e/02-game-controls.spec.js: start solo race, simulate keyboard inputs (Z accelerate, Q/D steer, Space drift), verify kart position changes over time, press Escape, verify pause menu opens, press Escape again to resume
- [x] T087 [P] Create tests/e2e/03-items-system.spec.js: start race, expose test hook to force item crate pickup, verify item appears in HUD slot, activate item, verify item effect (e.g., Boost Nitro increases speed)
- [x] T088 [P] Create tests/e2e/04-multiplayer-local.spec.js: start 2-player local game, verify split-screen renders 2 viewports, simulate P1 and P2 inputs simultaneously, verify both karts move independently
- [x] T089 [P] Create tests/e2e/05-multiplayer-online.spec.js: open 2 browser contexts, create room in context 1, join with code in context 2, verify both players appear in lobby, start race, verify both viewports update
- [x] T090 [P] Create tests/e2e/06-pause-menu.spec.js: start race, open pause menu, change audio volume slider, remap a key, close pause menu, reopen and verify settings persisted
- [x] T091 [P] Create tests/e2e/07-performance.spec.js: start race with 8 karts, measure frame rate via requestAnimationFrame timestamps over 10s, assert >= 30fps on mobile profile, measure page load time assert < 8s
- [x] T092 [P] Create tests/e2e/08-mobile-controls.spec.js: use mobile device profile, simulate touch events for virtual joystick (touchstart + touchmove), verify kart steers, test portrait orientation warning appears

---

## Phase 14: Polish & Cross-Cutting Concerns

**Purpose**: Final quality improvements across all stories

- [x] T093 [P] Add procedural audio: character voice lines (synthesized beep patterns unique per character) at selection, podium, and signature weapon use in src/engine/AudioEngine.js
- [x] T094 [P] Implement reflection maps on metallic karts (Krogash, D4SH) in src/engine/Renderer.js: CubeCamera updated every 10 frames, apply as envMap on toon shader with low intensity
- [x] T095 [P] Add lens flare effect for bright light sources (lava on Volcan, neon on NeonCity) as billboard sprites with cell-shaded style in src/engine/Renderer.js
- [x] T096 Performance optimization pass: profile with Chrome DevTools, ensure instanced meshes for repeated props (trees, barriers, crates), LOD on kart models (reduce at distance), object pool for all item projectiles/particles, verify <100 draw calls per viewport
- [x] T097 Polish UI typography and animations: load Press Start 2P font for titles and Rajdhani for body text, add character-specific accent colors to pause menu, smooth accordion transitions in settings, pulsating Resume button
- [x] T098 Run quickstart.md validation: follow setup steps from scratch, verify dev server starts, verify game server starts, verify game loads and is playable
- [x] T099 Add AI personality per character in src/game/AIController.js: Krogash drives straight (avoids turns), Sylvara always takes shortcuts, Zyrx holds items for critical moments (use only when targeted or near finish), Sharko prioritizes water sections, Vermox uses fire trail defensively

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — the MVP
- **US2 (Phase 4)**: Depends on US1 (extends KartController and ItemSystem)
- **US3 (Phase 5)**: Depends on US1 (extends circuits and RaceManager)
- **US4 (Phase 6)**: Depends on Phase 2 only (split-screen is renderer-level)
- **US5 (Phase 7)**: Depends on US4 (crew mode extends split-screen)
- **US9 (Phase 8)**: Depends on Phase 2 only (pause menu is UI overlay)
- **US6 (Phase 9)**: Depends on US1 (online needs working race)
- **US7 (Phase 10)**: Depends on Phase 2 only (mobile input is engine-level)
- **US8 (Phase 11)**: Depends on US1 (time trial/GP extend race modes)
- **US10 (Phase 12)**: Depends on US1 (progression needs race completion data)
- **E2E Tests (Phase 13)**: Depends on all user stories being complete
- **Polish (Phase 14)**: Depends on all user stories being complete

### User Story Dependencies

```
Phase 1 (Setup)
  └→ Phase 2 (Foundational)
       ├→ US1 (Phase 3) ← MVP
       │    ├→ US2 (Phase 4)
       │    ├→ US3 (Phase 5)
       │    ├→ US6 (Phase 9)
       │    ├→ US8 (Phase 11)
       │    └→ US10 (Phase 12)
       ├→ US4 (Phase 6)
       │    └→ US5 (Phase 7)
       ├→ US9 (Phase 8)
       └→ US7 (Phase 10)
```

### Parallel Opportunities

After Phase 2 (Foundational), these can proceed in parallel:
- **Track A**: US1 → US2 → US3 (core gameplay depth)
- **Track B**: US4 → US5 (local multiplayer)
- **Track C**: US9 (pause menu)
- **Track D**: US7 (mobile)

After US1 completes, additionally:
- **Track E**: US6 (online multiplayer)
- **Track F**: US8 (time trial / grand prix)
- **Track G**: US10 (progression)

---

## Parallel Example: User Story 2

```bash
# All 8 character modules can be created in parallel (different files):
Task: T028 "Create src/characters/Rico.js"
Task: T029 "Create src/characters/Zyrx.js"
Task: T030 "Create src/characters/Krogash.js"
Task: T031 "Create src/characters/D4sh.js"
Task: T032 "Create src/characters/Vermox.js"
Task: T033 "Create src/characters/Sylvara.js"
Task: T034 "Create src/characters/Sharko.js"
Task: T035 "Create src/characters/GrootX.js"

# Then sequential integration:
Task: T036 "Update KartController with character physics"
Task: T037 "Update ItemSystem with all weapons"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (T001-T006)
2. Complete Phase 2: Foundational (T007-T014)
3. Complete Phase 3: US1 (T015-T027)
4. **STOP and VALIDATE**: Race Volcan Peak as Rico against 7 AI, use 5 items, see results
5. This is a playable game

### Incremental Delivery

1. Setup + Foundational → Engine ready
2. + US1 → Playable solo race (MVP!)
3. + US2 → 8 unique characters with weapons/passives
4. + US3 → 5 circuits with weather/shortcuts
5. + US4 → Local split-screen
6. + US5 → Crew mode
7. + US9 → Settings/pause menu
8. + US6 → Online multiplayer
9. + US7 → Mobile support
10. + US8 → Time trial/Grand Prix
11. + US10 → Progression
12. + E2E Tests → Quality assurance
13. + Polish → Production ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Total item count: 25 items (16 generic + 1 legendary + 8 signature weapons)
- Default lap count: 3 per race (configurable)
