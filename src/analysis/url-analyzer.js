import brands from '../../data/official-domains.js';
import shorteners from '../../data/url-shorteners.js';
import { findBrandReferences, matchesDomain } from './brand-rules.js';
import { overallStatus } from './risk-model.js';

const sensitiveWords = new Set([
  'login', 'verify', 'account', 'secure', 'payment', 'wallet',
  'otp', 'password', 'update', 'recovery'
]);

function internalIPv4(host) {
  const [a, b] = host.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function internalIPv6(host) {
  const parts = host.slice(1, -1).split('::');
  const left = parts[0] ? parts[0].split(':') : [];
  const right = parts[1] ? parts[1].split(':') : [];
  const groups = parts.length === 2
    ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
    : left;
  const values = groups.map(part => parseInt(part, 16));
  if (values.slice(0, 7).every(value => value === 0) && values[7] <= 1) return true;
  if ((values[0] & 0xfe00) === 0xfc00 || (values[0] & 0xffc0) === 0xfe80) return true;
  // WHATWG URL normalizes IPv4-mapped addresses into hexadecimal groups.
  if (values.slice(0, 5).every(value => value === 0) && values[5] === 0xffff) {
    return internalIPv4(`${values[6] >> 8}.${values[6] & 255}.${values[7] >> 8}.${values[7] & 255}`);
  }
  return false;
}

function unavailable(id, title, detected) {
  return {
    available: false, domain: null, scheme: null, status: 'Review',
    findings: [{ id, level: 'review', title, detected,
      why: 'PrivacyLens only analyzes complete HTTP and HTTPS website addresses.',
      suggestion: 'Open a website and click PrivacyLens again.' }]
  };
}

export function analyzeUrl(input) {
  if (typeof input !== 'string' || !input.trim()) {
    return unavailable('invalid-url', 'Address unavailable', 'No usable address was provided.');
  }
  let url;
  try { url = new URL(input); }
  catch { return unavailable('invalid-url', 'Address unavailable', 'The address could not be read.'); }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return unavailable('unsupported-url', 'This page cannot be analyzed', 'This is not an HTTP or HTTPS website.');
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const ipv4 = /^\d+\.\d+\.\d+\.\d+$/.test(host);
  const ipv6 = host.startsWith('[');
  const internal = ipv4 ? internalIPv4(host) : ipv6 ? internalIPv6(host) :
    !host.includes('.') || ['localhost', 'local', 'internal'].some(domain => matchesDomain(host, domain));
  const findings = [];
  const add = (id, level, title, detected, why, suggestion) =>
    findings.push({ id, level, title, detected, why, suggestion });

  if (url.protocol === 'https:') {
    add('https', 'info', 'HTTPS connection', 'The address uses HTTPS.',
      'HTTPS is intended to encrypt the connection. This URL check does not verify a certificate or prove the site is trustworthy.',
      'Still check the address before sharing sensitive information.');
  } else {
    add('http', internal ? 'info' : 'review', 'HTTP connection', 'The address uses HTTP instead of HTTPS.',
      'HTTP does not encrypt the connection. This does not mean the site contains malware.',
      internal ? 'HTTP is common during local development. Avoid sending real secrets over it.' : 'Use the official HTTPS address before entering private information.');
  }
  if (internal) {
    add('internal', 'info', 'Local or internal address', 'The hostname is a local name or an internal-use address.',
      'This may be a development server, router, or private network service. An internal address is not automatically trustworthy; no DNS lookup was performed.',
      'Use it only if you recognize the service and your network.');
  }
  if (ipv4 || ipv6) {
    add('ip-address', internal ? 'info' : 'review', 'IP address instead of a domain', 'The host is a numeric IP address.',
      'An IP address does not give you a familiar organization name. Legitimate services can also use IP addresses.',
      'Check that this is the address you intended to use.');
  }
  if (!ipv4 && !ipv6 && host.length > 60) {
    add('long-hostname', 'review', 'Unusually long hostname', `The hostname has ${host.length} characters (threshold: more than 60).`,
      'A long address can make the actual domain harder to notice. Long domains can still be legitimate.',
      'Read the full hostname carefully.');
  }
  if (!ipv4 && !ipv6 && host.split('.').length > 5) {
    add('deep-hostname', 'review', 'Many hostname levels', 'The hostname has more than five dot-separated labels.',
      'Deep names can obscure the domain at the right-hand end. This simple rule does not use a public suffix list, so it only estimates subdomain depth.',
      'Check the right-hand end of the address and compare it with the official site.');
  }
  if (url.port) {
    add('nonstandard-port', internal ? 'info' : 'review', 'Non-standard port', `The address explicitly uses port ${url.port}.`,
      'This differs from the usual port for its scheme. Custom ports are common for development and some legitimate services.',
      'Make sure you intended to use this service and port.');
  }
  if (url.username || url.password || /^https?:\/\/[^/?#]*@/i.test(input.trim())) {
    add('userinfo', 'review', 'Username / @ syntax', 'The address contains user information before the hostname.',
      'Text before @ is not the destination domain and may distract from where the address really goes. Credentials are not displayed.',
      'Check the hostname shown above and avoid opening URLs containing passwords.');
  }
  if (host.split('.').some(label => label.startsWith('xn--'))) {
    add('punycode', 'review', 'Internationalized hostname', 'A hostname label starts with xn-- (punycode).',
      'This encodes non-ASCII characters. Many internationalized domains are legitimate, but similar-looking characters can be confusing.',
      'Compare the address with a trusted source.');
  }
  if (shorteners.some(domain => matchesDomain(host, domain))) {
    add('shortener', 'review', 'Known URL shortener', 'The hostname matches the local list of URL shorteners.',
      'The address hides its final destination. PrivacyLens does not follow links or redirects.',
      'Ask for the direct destination if you do not recognize the source.');
  }
  for (const brand of findBrandReferences(host, brands)) {
    add('brand-mismatch', 'review', `Brand/domain mismatch: ${brand.name}`,
      `The domain contains a reference to ${brand.name} but does not match a known official ${brand.name} domain. Review the address before entering sensitive information.`,
      'A brand name in an unrelated hostname can be misleading. The small reference list is incomplete; this is not confirmed phishing.',
      'Compare with the official address from a trusted source.');
  }
  // Decode locally to recognize encoded words; never display paths, queries, or credentials.
  let wordSource = `${host} ${url.pathname} ${url.search}`;
  try { wordSource = decodeURIComponent(wordSource); } catch { /* Keep undecodable text. */ }
  const words = [...new Set(wordSource.toLowerCase().split(/[^a-z]+/).filter(word => sensitiveWords.has(word)))];
  if (words.length) {
    add('sensitive-words', 'info', 'Sensitive-action words', `Address words: ${words.join(', ')}.`,
      'These words are common on legitimate sites and do not establish malicious intent. Sensitive actions deserve extra care, especially over HTTP.',
      'Check the destination before entering passwords, payment details, or one-time codes.');
  }
  return { available: true, domain: host, scheme: url.protocol.slice(0, -1).toUpperCase(),
    status: overallStatus(findings, internal), findings };
}
