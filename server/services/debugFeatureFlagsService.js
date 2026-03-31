const { parseBooleanFlag } = require('../utils/debugMode');

const FLAG_NAMES = [
  'ENABLE_DYNAMIC_BRANCHING',
  'ENABLE_STEP_CONFIDENCE',
  'ENABLE_PATTERN_ANALYTICS',
];

const runtimeOverrides = new Map();

function getDefaultFlagValue(flagName) {
  if (flagName === 'ENABLE_PATTERN_ANALYTICS') {
    return parseBooleanFlag(process.env.ENABLE_PATTERN_ANALYTICS);
  }

  return process.env[flagName] !== 'false';
}

function getFeatureFlag(flagName) {
  if (!FLAG_NAMES.includes(flagName)) {
    throw new Error(`Unsupported feature flag: ${flagName}`);
  }

  if (runtimeOverrides.has(flagName)) {
    return runtimeOverrides.get(flagName);
  }

  return getDefaultFlagValue(flagName);
}

function getFeatureFlagsSnapshot() {
  return FLAG_NAMES.reduce((snapshot, flagName) => {
    snapshot[flagName] = getFeatureFlag(flagName);
    return snapshot;
  }, {});
}

function setFeatureFlag(flagName, enabled) {
  if (!FLAG_NAMES.includes(flagName)) {
    throw new Error(`Unsupported feature flag: ${flagName}`);
  }

  runtimeOverrides.set(flagName, Boolean(enabled));
  return getFeatureFlagsSnapshot();
}

module.exports = {
  FLAG_NAMES,
  getFeatureFlag,
  getFeatureFlagsSnapshot,
  setFeatureFlag,
};
