# Research: KHAOS KART

**Branch**: `001-khaos-kart-game` | **Date**: 2026-03-07

## Rendering & Shading

### Decision: Three.js (latest stable r182+) with WebGLRenderer
- **Rationale**: WebGPU-ready API but WebGL as primary target for broader compatibility. WebGPURenderer can be swapped later with minimal code changes.
- **Alternatives considered**: Babylon.js (heavier, less toon-shader community resources), PlayCanvas (SaaS-oriented).

### Decision: Custom ShaderMaterial for toon shading (not MeshToonMaterial)
- **Rationale**: MeshToonMaterial is limited -- no control over rim lighting, specular steps, or shadow color. Custom shader gives 5 controllable components: flat base color, stepped core shadows (via smoothstep), Blinn-Phong specular with step cutoff, rim lighting, shadow map integration.
- **Alternatives considered**: MeshToonMaterial (too limited for the saturated, contrasty style needed per circuit).

### Decision: Inverted hull outlines (not post-processing edge detection)
- **Rationale**: Per-object technique with predictable cost. Works well with instancing. No full-screen post-processing pass needed, which is critical for split-screen (each viewport would need its own post-processing pipeline otherwise).
- **Alternatives considered**: Sobel edge detection via EffectComposer (too expensive for 4-viewport split-screen), OutlineEffect addon (designed for selection highlighting, not global toon outlines).

## Physics

### Decision: Rapier.js (WASM)
- **Rationale**: 2-5x faster than cannon-es for equivalent scenes. Deterministic simulation useful for replays and networking. Good Three.js integration patterns.
- **Alternatives considered**: cannon-es (pure JS, easier to debug, but performance ceiling too low for 8 karts + items + environment).

### Decision: Hybrid kart physics -- custom arcade movement + Rapier for collisions only
- **Rationale**: Full vehicle physics simulation (wheel friction, suspension) fights against arcade feel. Custom movement code gives complete control over steering arcs, drift state machine, and boost.
- **Rapier's role**: Kinematic rigid bodies (position set each frame from custom code). Collisions detection + raycasts for ground detection/surface type. Static colliders for track walls and boundaries.
- **Kart movement model**: Circle-based steering (radius depends on speed + input), drift as state machine with boost tier accumulation, speed model with acceleration curves + drag + surface modifiers.

## Networking

### Decision: Server-authoritative with client-side prediction
- **Rationale**: Even for casual play, client-authoritative models allow cheating (teleporting, false race positions). Client-side prediction gives responsiveness while server remains source of truth. Kart physics are highly predictable so corrections will be rare.
- **Server owns**: Physics tick, collision resolution, item pickups, race position, finish order.
- **Client predicts**: Local kart only. Remote karts rendered via entity interpolation.

### Decision: Socket.io for networking (over Colyseus or raw WebSocket)
- **Rationale**: Socket.io offers good balance of features (rooms, events, reconnection) with wide community adoption. While Colyseus provides more game-specific features and raw uWebSockets.js is faster, Socket.io matches the user's specified stack and is sufficient for 8-player rooms at 20Hz tick rate. Binary serialization (MessagePack) can be added on top for bandwidth optimization.
- **Alternatives considered**: Colyseus (purpose-built for game servers, excellent features, but adds framework dependency and learning curve), raw ws/uWebSockets.js (maximum performance but requires building rooms/reconnection/serialization from scratch).

### Decision: Input-upstream / snapshot-downstream at 20Hz
- **Rationale**: Send player inputs (steering, throttle, brake, item-use) to server. Server broadcasts delta-compressed state snapshots at 20Hz. Remote karts use 100ms interpolation buffer with hermite spline interpolation. Target bandwidth under 256 kbps per client.

### Decision: Client-side prediction + reconciliation, no server rewind
- **Rationale**: Circular buffer of recent inputs/predicted states. On server state arrival, compare and re-simulate if different. Server rewind unnecessary for racing (spatial interactions tolerate ~100ms imprecision, unlike FPS hit detection).

### Decision: Server-managed rooms, no host migration
- **Rationale**: Since server is authoritative, there is no "host" among players. Room lifecycle (create/join/leave/dispose) managed entirely server-side. Host migration is complex and unnecessary.

## Audio

### Decision: Howler.js for SFX/music + raw Web Audio API for engine synthesis
- **Rationale**: Howler.js (~7KB) covers 80% of game audio (SFX, music loops, 3D spatial). Tone.js (~150KB) is overkill (DAW-oriented). For engine sounds, use raw Web Audio API via Howler's exposed AudioContext.
- **Alternatives considered**: Tone.js (too heavy, designed for music production apps), pure Web Audio API (too much boilerplate for standard SFX).

### Decision: Web Audio API AudioBufferSourceNodes with shared timeline for dynamic music
- **Rationale**: Each stem (bass, drums, melody, tension) loaded as separate AudioBuffer, routed through individual GainNodes. All stems start simultaneously via scheduled currentTime. Crossfade via linearRampToValueAtTime. Keep only 2 channels at full processing; silent stems optimized by browser.

### Decision: Hybrid engine sound -- short looping sample + playbackRate modulation
- **Rationale**: Pure oscillator synthesis is CPU-heavy and hard to make convincing. Short recorded engine loop (~0.5s) with playbackRate modulated by speed (1.0 idle to 2.5 full speed) gives realistic timbre with dynamic pitch. Layer subtle oscillator underneath for low-frequency rumble.

## Mobile & PWA

### Decision: nipple.js for virtual joystick
- **Rationale**: ~10KB, provides angle/force/direction data out of the box. "Semi" mode (joystick appears at touch point, snaps back) is ideal for racing. Extensive configuration (dead zones, threshold, appearance via CSS).
- **Alternatives considered**: Custom implementation (same result, much more work, no benefit).

### Decision: vite-plugin-pwa with registerType 'prompt'
- **Rationale**: Prompt mode lets players finish current race before SW activates new version. Precache core shell; runtime-cache large assets (textures, models, audio) with CacheFirst strategy. Display 'fullscreen', orientation 'landscape'.

### Decision: Multi-signal scoring for quality profile detection + runtime adaptive
- **Rationale**: Combine hardwareConcurrency, touch capability, and screen size into a score. Low/Medium/High profiles. Also monitor actual FPS at runtime -- auto-downgrade if sustained below 30fps.

### Decision: DeviceOrientation API for gyroscope (optional, gamma axis)
- **Rationale**: Fun novelty, ~70-80% mobile device support. Use gamma (left/right tilt) for steering, apply dead zone (~5-10 degrees), low-pass filter noise, require calibration step. Touch controls remain default. iOS requires explicit requestPermission() from user gesture.

## Build & Testing

### Decision: Vite.js for build tooling
- **Rationale**: Per user specification. HMR for fast development, optimized production bundles, native ESM support, excellent Three.js/WASM integration.

### Decision: Playwright for E2E testing
- **Rationale**: Per user specification. Multi-browser/device profiles. WebGL testing via headless Chrome. Performance measurement via CDP.
