const STORAGE_VERSION = 1;
const PREFIX = 'khaos-kart-';

const DEFAULT_PROFILE = {
  bestTimes: {},
  totalRaces: 0,
  totalWins: 0,
  totalItemsUsed: 0,
  totalDistance: 0,
  unlockedCharacters: ['rico', 'zyrx', 'krogash', 'd4sh', 'vermox', 'sylvara', 'sharko', 'grootx'],
  unlockedSkins: {},
  settings: {
    masterVolume: 1.0,
    musicVolume: 0.7,
    sfxVolume: 0.8,
    engineVolume: 0.6,
    musicMode: 'dynamic',
    spatialAudio: true,
    quality: 'high',
    renderResolution: 1.0,
    shadows: true,
    particles: 'normal',
    weatherEffects: true,
    reflections: true,
    postProcessing: 'full',
    vsync: true,
    showFPS: false,
    steeringAssist: 'off',
    trackIndicators: true,
    minimapSize: 'small',
    showOpponentStats: false,
    splitScreenOrientation: 'horizontal',
    language: 'en',
    textSize: 'normal',
    colorblindMode: 'off',
    reduceStrobe: false
  }
};

function read(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data._v !== STORAGE_VERSION) return null;
    return data.value;
  } catch (_) {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ _v: STORAGE_VERSION, value }));
  } catch (_) { /* storage full or unavailable */ }
}

export const Storage = {
  getProfile() {
    return read('profile') || { ...DEFAULT_PROFILE };
  },

  saveProfile(profile) {
    write('profile', profile);
  },

  updateProfile(updates) {
    const profile = this.getProfile();
    Object.assign(profile, updates);
    this.saveProfile(profile);
    return profile;
  },

  getSettings() {
    const profile = this.getProfile();
    return { ...DEFAULT_PROFILE.settings, ...profile.settings };
  },

  saveSettings(settings) {
    const profile = this.getProfile();
    profile.settings = { ...profile.settings, ...settings };
    this.saveProfile(profile);
  },

  getBestTime(circuitId) {
    const profile = this.getProfile();
    return profile.bestTimes[circuitId] || null;
  },

  setBestTime(circuitId, time) {
    const profile = this.getProfile();
    const current = profile.bestTimes[circuitId];
    if (!current || time < current) {
      profile.bestTimes[circuitId] = time;
      this.saveProfile(profile);
      return true;
    }
    return false;
  },

  getGhost(circuitId, characterId) {
    return read(`ghost-${circuitId}-${characterId}`);
  },

  saveGhost(circuitId, characterId, ghostData) {
    write(`ghost-${circuitId}-${characterId}`, ghostData);
  },

  recordRaceResult({ circuitId, characterId, position, time, itemsUsed = 0, distance = 0 }) {
    const profile = this.getProfile();
    profile.totalRaces = (profile.totalRaces || 0) + 1;
    if (position === 1) profile.totalWins = (profile.totalWins || 0) + 1;
    profile.totalItemsUsed = (profile.totalItemsUsed || 0) + itemsUsed;
    profile.totalDistance = (profile.totalDistance || 0) + distance;

    // Track wins per character
    if (!profile.characterWins) profile.characterWins = {};
    if (position === 1) {
      if (!profile.characterWins[characterId]) profile.characterWins[characterId] = { total: 0, circuits: {} };
      profile.characterWins[characterId].total++;
      profile.characterWins[characterId].circuits[circuitId] = true;
    }

    // Track character race count
    if (!profile.characterRaces) profile.characterRaces = {};
    profile.characterRaces[characterId] = (profile.characterRaces[characterId] || 0) + 1;

    // Best time
    if (time && (!profile.bestTimes[circuitId] || time < profile.bestTimes[circuitId])) {
      profile.bestTimes[circuitId] = time;
    }

    this.saveProfile(profile);
    return profile;
  },

  checkUnlocks(profile) {
    const unlocks = [];
    const chars = profile.unlockedCharacters || [];
    const wins = profile.characterWins || {};
    const baseChars = ['rico', 'zyrx', 'krogash', 'd4sh', 'vermox', 'sylvara', 'sharko', 'grootx'];

    // Hidden char 1: "chaos" - win 1st with all 8 base characters
    if (!chars.includes('chaos')) {
      const allWon = baseChars.every(c => wins[c]?.total > 0);
      if (allWon) {
        profile.unlockedCharacters.push('chaos');
        unlocks.push('chaos');
      }
    }

    // Hidden char 2: "glitch" - complete all 5 circuits in Grand Prix
    if (!chars.includes('glitch') && profile.grandPrixComplete) {
      profile.unlockedCharacters.push('glitch');
      unlocks.push('glitch');
    }

    if (unlocks.length > 0) this.saveProfile(profile);
    return unlocks;
  },

  clear() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }
};
