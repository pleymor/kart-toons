import { VolcanPeak } from './VolcanPeak.js';
import { NeonCity } from './NeonCity.js';
import { CrystalForest } from './CrystalForest.js';
import { AbyssalReef } from './AbyssalReef.js';
import { RuinsOfKhaos } from './RuinsOfKhaos.js';
import { TestArena } from './TestArena.js';

const CIRCUITS = {
  'volcan-peak': VolcanPeak,
  'neon-city': NeonCity,
  'crystal-forest': CrystalForest,
  'abyssal-reef': AbyssalReef,
  'ruins-of-khaos': RuinsOfKhaos,
  'test-arena': TestArena
};

export function getCircuit(id) {
  return CIRCUITS[id] || null;
}

export function getAllCircuits() {
  return Object.values(CIRCUITS);
}

export function getCircuitIds() {
  return Object.keys(CIRCUITS);
}
