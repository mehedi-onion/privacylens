import { permissionDefinitions, permissionStateLabels } from './permission-definitions.js';

const unavailableExplanations = {
  'unsupported-page': 'Only HTTP and HTTPS website settings can be checked here.',
  'unsupported-api': 'This browser does not expose this content-setting reader.',
  'read-failed': 'The browser could not return this setting. Check it in the browser’s site settings.',
  'invalid-response': 'The browser returned an unrecognized setting. PrivacyLens has not guessed a state.'
};

function explainState(state, reason) {
  if (state === 'unavailable') {
    return unavailableExplanations[reason] ?? 'This setting could not be read. Check the browser’s site settings.';
  }
  if (state === 'allow') return 'The browser reports Allowed. This does not show whether the site is using the feature; other browser or device rules may still prevent access.';
  if (state === 'block') return 'The browser reports Blocked for this content setting.';
  return 'The browser reports Ask. It does not identify whether this comes from a default or a site-specific choice.';
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
    why: 'These features may be useful together. A setting alone does not show use or misuse.',
    suggestion: 'This site currently has several sensitive permissions. Review whether you still need them.'
  }] : [];
  return { permissions, notes, status: notes.length ? 'Review' : 'Normal' };
}

export function combineStatuses(urlStatus, permissionStatus) {
  if (urlStatus === 'High Attention' || permissionStatus === 'High Attention') return 'High Attention';
  return urlStatus === 'Review' || permissionStatus === 'Review' ? 'Review' : 'Normal';
}
