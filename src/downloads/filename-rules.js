const executableTypes = new Set(['exe', 'msi', 'bat', 'cmd', 'scr', 'ps1', 'js', 'jar', 'apk', 'dmg', 'pkg']);
const archiveTypes = new Set(['zip', 'rar', '7z', 'iso']);
const disguiseTypes = new Set(['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'jpg', 'jpeg', 'png', 'gif', 'mp3', 'mp4']);
const directional = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/;

export function describeFilename(value) {
  const basename = typeof value === 'string' ? value.split(/[\\/]/).pop() : '';
  if (!basename || basename.length > 1024) return { display: 'Filename unavailable', extension: null,
    executable: false, archive: false, doubleExtension: false, spacing: false, directional: false, available: false };
  const segments = basename.toLowerCase().trimEnd().split('.');
  const extension = segments.length > 1 && /^[a-z0-9]{1,12}$/.test(segments[segments.length - 1]) ? segments[segments.length - 1] : null;
  const executable = executableTypes.has(extension);
  const escaped = basename.replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
    character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const display = escaped.length > 255 ? `${escaped.slice(0, 170)}…${escaped.slice(-70)}` : escaped;
  return { display, extension, executable, archive: archiveTypes.has(extension), available: true,
    doubleExtension: executable && segments.length > 2 && disguiseTypes.has(segments[segments.length - 2]),
    spacing: / {5,}\.[a-z0-9]+\s*$/i.test(basename), directional: directional.test(basename) };
}
