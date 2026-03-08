const BUFFER_SIZE = 128;

export class Prediction {
  constructor() {
    this.inputBuffer = []; // [{tick, input, predictedState}]
    this.lastServerTick = 0;
    this.lastServerState = null;
    this.correctionSmoothing = 0;
    this.correctionTarget = null;
  }

  addInput(tick, input, predictedState) {
    this.inputBuffer.push({ tick, input, predictedState });
    if (this.inputBuffer.length > BUFFER_SIZE) {
      this.inputBuffer.shift();
    }
  }

  onServerSnapshot(serverTick, serverState, reSimulate) {
    this.lastServerTick = serverTick;
    this.lastServerState = serverState;

    // Find our prediction for this tick
    const predIdx = this.inputBuffer.findIndex(e => e.tick === serverTick);
    if (predIdx < 0) return null;

    const predicted = this.inputBuffer[predIdx].predictedState;
    const dx = serverState.x - predicted.x;
    const dz = serverState.z - predicted.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Discard old inputs
    this.inputBuffer = this.inputBuffer.filter(e => e.tick > serverTick);

    if (dist < 0.5) {
      // Small correction: smooth
      return null;
    }

    // Large correction: snap to server and re-simulate
    if (reSimulate) {
      let state = { ...serverState };
      for (const entry of this.inputBuffer) {
        state = reSimulate(state, entry.input);
        entry.predictedState = { ...state };
      }
      return state;
    }

    // If no re-simulate function, just return server state
    this.correctionTarget = serverState;
    this.correctionSmoothing = 1.0;
    return serverState;
  }

  applySmoothing(currentState, delta) {
    if (!this.correctionTarget || this.correctionSmoothing <= 0) return currentState;

    const blend = Math.min(1, delta * 5); // blend over ~200ms
    this.correctionSmoothing -= blend;

    if (this.correctionSmoothing <= 0) {
      this.correctionTarget = null;
      return currentState;
    }

    return {
      ...currentState,
      x: currentState.x + (this.correctionTarget.x - currentState.x) * blend,
      z: currentState.z + (this.correctionTarget.z - currentState.z) * blend
    };
  }
}
