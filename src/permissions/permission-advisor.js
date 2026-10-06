import { permissionDefinitions, permissionStateLabels } from './permission-definitions.js';

const unavailableExplanations = {
  'unsupported-page': 'Only HTTP and HTTPS website settings can be checked here.',
  'unsupported-api': 'This browser does not let PrivacyLens read this site setting.',
  'read-failed': 'The browser could not return this setting. Check it in the browser’s site settings.',
  'invalid-response': 'PrivacyLens did not recognize the browser’s answer, so it cannot show this setting.'
};

function explainState(state, reason) {
  if (state === 'unavailable') {
    return unavailableExplanations[reason] ?? 'This setting could not be read. Check the browser’s site settings.';
  }
  if (state === 'allow') return 'Your browser says Allowed. That shows permission, not current use. Other browser or device settings may still prevent access.';
  if (state === 'block') return 'Your browser says this feature is blocked for the site.';
  return 'Your browser says Ask. It does not say whether this is the browser default or a choice for this site.';
}

export function advisePermissions(readings = []) {
  // Always use the fixed definitions; omit unexpected IDs and duplicate input.
  const permissions = permissionDefinitions.map(definition => {
    const reading = Array.isArray(readings) ? readings.find(item => item?.id === definition.id) : null;
    const state = definition.states.includes(reading?.state) ? reading.state : 'unavailable';
    return { ...definition, state, label: permissionStateLabels[state],
      stateExplanation: explainState(state, reading?.reason) };
  });
  const allowedSensitive = permissions.filter(permission => permission.sensitive && permission.state === 'allow');
  const notes = allowedSensitive.length === 3 ? [{
    id: 'several-sensitive-permissions', level: 'review',
    title: 'Several sensitive settings are allowed',
    detected: 'Camera, microphone, and location are all Allowed in the browser’s content settings.',
    why: 'Some features need all three. These settings do not tell us whether the site is using them.',
    suggestion: 'Review whether you still need camera, microphone and location access on this site.'
  }] : [];
  return { permissions, notes, status: notes.length ? 'Review' : 'Normal' };
}

export function combineStatuses(urlStatus, permissionStatus) {
  if (urlStatus === 'High Attention' || permissionStatus === 'High Attention') return 'High Attention';
  return urlStatus === 'Review' || permissionStatus === 'Review' ? 'Review' : 'Normal';
}
