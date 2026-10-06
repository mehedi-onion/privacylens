// These are content-setting names, not permission requests to use devices.
export const permissionDefinitions = [
  {
    id: 'camera', name: 'Camera', states: ['allow', 'block', 'ask'], sensitive: true,
    allows: 'The site may use your camera if browser and device settings allow it.',
    legitimateUses: 'Video calls, QR scanning, or identity verification.',
    reviewWhen: 'There is no camera feature you use, access was allowed accidentally, or you no longer need the feature.',
    recommendation: 'Keep camera access blocked unless you actively use a feature that needs it.'
  },
  {
    id: 'microphone', name: 'Microphone', states: ['allow', 'block', 'ask'], sensitive: true,
    allows: 'The site may record audio if browser and device settings allow it.',
    legitimateUses: 'Voice calls, voice messages, or speech input.',
    reviewWhen: 'There is no audio feature you use, access was allowed accidentally, or you have finished using it.',
    recommendation: 'Keep microphone access blocked unless you need an audio feature.'
  },
  {
    id: 'location', name: 'Location', states: ['allow', 'block', 'ask'], sensitive: true,
    allows: 'The site may request your device location through the browser.',
    legitimateUses: 'Maps, directions, or finding nearby services.',
    reviewWhen: 'A site does not need your location for the task, or a typed city would be enough.',
    recommendation: 'Use location access only when it helps the feature you are using.'
  },
  {
    id: 'notifications', name: 'Notifications', states: ['allow', 'block', 'ask'], sensitive: false,
    allows: 'The site may show notifications. Browser and system settings can still limit them.',
    legitimateUses: 'Message alerts, appointment reminders, or updates you requested.',
    reviewWhen: 'Alerts are unwanted, were enabled by mistake, or are no longer useful.',
    recommendation: 'Allow notifications only for sites whose alerts you want.'
  },
  {
    id: 'popups', name: 'Pop-ups', states: ['allow', 'block'], sensitive: false,
    allows: 'This browser setting allows the site to open pop-up windows.',
    legitimateUses: 'A sign-in window, a payment step, or a separate document view.',
    reviewWhen: 'Windows open unexpectedly, or you no longer need the feature that required them.',
    recommendation: 'Keep pop-ups blocked unless a feature you trust needs them.'
  },
  {
    id: 'automaticDownloads', name: 'Automatic downloads', states: ['allow', 'block', 'ask'], sensitive: false,
    allows: 'The site may download multiple files automatically after the first file.',
    legitimateUses: 'Exporting several documents, photos, or reports together.',
    reviewWhen: 'You did not expect several files, or you have finished the export.',
    recommendation: 'Keep this on Ask or Blocked unless you expect a batch of files.'
  }
];

export const permissionStateLabels = {
  allow: 'Allowed', block: 'Blocked', ask: 'Ask', unavailable: 'Unavailable'
};

// Chrome returns the effective setting, not its source. A literal "default"
// or an unsupported value must never be converted into a guessed permission.
export function normalizePermissionState(response, definition) {
  return response && typeof response === 'object' && !Array.isArray(response) &&
    definition.states.includes(response.setting) ? response.setting : 'unavailable';
}
