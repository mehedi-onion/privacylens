import { analyzeUrl } from '../analysis/url-analyzer.js';
import { matchesDomain } from '../analysis/brand-rules.js';
import brands from '../../data/official-domains.js';

export function unavailablePageScan() {
  return { available: false, domain: null, status: null, findings: [], reviewCount: 0,
    message: 'Page scan unavailable. Open an ordinary HTTP/HTTPS page and reopen PrivacyLens. Restricted pages or browser rules can prevent access.' };
}

function originAddress(input) {
  if (typeof input !== 'string') return null;
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol) || input !== url.origin) return null;
    return url;
  } catch { return null; }
}

export function analyzePageMetadata(raw) {
  const page = originAddress(raw?.origin);
  const count = number => Number.isInteger(number) && number >= 0;
  if (!page || !Array.isArray(raw.forms) || raw.forms.length > 50 || !Array.isArray(raw.links) || raw.links.length > 200 ||
      !count(raw.passwordFields) || raw.passwordFields > 400 || !count(raw.linksInspected) || raw.linksInspected > 400 ||
      !count(raw.externalHostCount) || raw.externalHostCount > 100 || typeof raw.capped !== 'boolean' ||
      !raw.frames || !['inspected', 'crossOrigin', 'unknown'].every(key => count(raw.frames[key])) ||
      raw.frames.inspected > 100 || raw.frames.crossOrigin + raw.frames.unknown > raw.frames.inspected) return unavailablePageScan();
  const findings = [];
  const add = (id, level, title, detected, why, suggestion) => findings.push({ id, level, title, detected, why, suggestion });
  const groups = new Map();
  const note = (id, title, detected, why, suggestion) => {
    const group = groups.get(id) || { title, count: 0, samples: new Set(), why, suggestion };
    group.count++;
    if (group.samples.size < 3) group.samples.add(detected);
    groups.set(id, group);
  };
  const sensitiveOffsiteHttp = new Set();
  let sensitiveSameOrigin = 0;
  let paymentForms = 0;
  let authenticationForms = 0;
  for (const form of raw.forms) {
    if (!form || !['password', 'authentication', 'payment'].every(key => typeof form[key] === 'boolean') ||
        !Array.isArray(form.destinations) || !form.destinations.length || form.destinations.length > 101) return unavailablePageScan();
    paymentForms += Number(form.payment);
    authenticationForms += Number(form.authentication);
    let staysHere = true;
    for (const target of form.destinations) {
      if (!target || !['web', 'dialog', 'unavailable'].includes(target.kind)) return unavailablePageScan();
      if (target.kind !== 'web') { staysHere = false; continue; }
      const destination = originAddress(target.origin);
      if (!destination || typeof target.hasUserInfo !== 'boolean') return unavailablePageScan();
      if (destination.origin !== page.origin) {
        staysHere = false;
        note('cross-origin-form', 'Form submits to another origin', destination.hostname,
          'The action or submit-button override uses a different scheme, hostname, or port. Sign-in providers and payment processors can legitimately do this. This is not proof of misuse.',
          'Check that you recognize the receiving service before submitting.');
        if (form.password || form.authentication || form.payment) {
          note('sensitive-cross-origin-form', 'Sensitive form uses another origin', destination.hostname,
            'Password, authentication, or payment-like metadata appears on a form with an external destination. No field values were inspected.',
            'Confirm the intended login or payment provider before entering private information.');
          if (page.protocol === 'https:' && destination.protocol === 'http:') sensitiveOffsiteHttp.add(destination.origin);
        }
      }
      if (page.protocol === 'https:' && destination.protocol === 'http:') note('http-form', 'HTTPS page has an HTTP form destination', destination.hostname,
        'The action points to an unencrypted address. Browser upgrades, blocking, or page scripts may change actual behavior; no submission was performed.', 'Use the intended HTTPS receiving service.');
      if (target.hasUserInfo) note('form-userinfo', 'Form address contains username / @ syntax', destination.hostname,
        'User information before @ is not the receiving hostname. That information is not displayed.', 'Check the receiving hostname carefully.');
    }
    if (form.password && staysHere && form.destinations.length) sensitiveSameOrigin++;
  }
  if (raw.passwordFields) add('password-fields', 'info', 'Password fields present', `Password fields inspected: ${raw.passwordFields}. Password forms with only same-origin HTTP/HTTPS destinations: ${sensitiveSameOrigin}.`,
    'Password fields are normal on sign-in and registration pages. Same-origin actions do not prove safety; scripts may change submission behavior.', 'Use the login feature only if you intended to sign in.');
  if (authenticationForms) add('authentication-forms', 'info', 'Authentication-like forms present', `Forms with password or recognized authentication autocomplete metadata: ${authenticationForms}.`,
    'These structural hints can describe ordinary login, registration, or account recovery features.', 'Compare the feature with what you intended to do.');
  if (paymentForms) add('payment-forms', 'info', 'Payment-like forms present', `Forms with recognized payment autocomplete metadata: ${paymentForms}.`,
    'Payment forms are normal at checkout. This check does not inspect card details or establish the purpose of the page.', 'Confirm the merchant and receiving service before using checkout.');
  let strongCombination = false;
  const seenLinks = new Set();
  const selectedSignals = new Set(['http', 'ip-address', 'punycode', 'shortener', 'brand-mismatch', 'long-hostname', 'deep-hostname', 'nonstandard-port']);
  for (const link of raw.links) {
    const destination = originAddress(link?.origin);
    if (!destination || typeof link.hasUserInfo !== 'boolean' ||
        !(link.claimedHost === null || typeof link.claimedHost === 'string' && /^[a-z0-9.-]{1,253}$/i.test(link.claimedHost)) ||
        !Array.isArray(link.claimedBrands) || link.claimedBrands.length > brands.length ||
        !Array.from(link.claimedBrands).every(name => brands.some(brand => brand.name === name))) return unavailablePageScan();
    const key = `${destination.origin}|${link.claimedHost || ''}|${link.claimedBrands.join(',')}|${link.hasUserInfo}`;
    if (seenLinks.has(key)) continue;
    seenLinks.add(key);
    const host = destination.hostname.toLowerCase().replace(/\.$/, '');
    const mismatch = link.claimedHost && !matchesDomain(host, link.claimedHost) && !matchesDomain(link.claimedHost, host);
    if (mismatch) note('misleading-link', 'Link text and destination differ', `${link.claimedHost} → ${host}`,
      'A domain-looking visible label names a different hostname. Redirects and related services can be legitimate; the final destination was not followed.', 'Inspect the destination before clicking.');
    for (const name of link.claimedBrands) {
      const brand = brands.find(entry => entry.name === name);
      if (!brand.domains.some(domain => matchesDomain(host, domain))) note('link-brand-reference', 'Link brand reference uses an unrelated hostname', `${name} → ${host}`,
        'The label refers to a brand but its destination is outside the small local official-domain list. The list is incomplete and does not establish intent.', 'Compare with the official address from a trusted source.');
    }
    const address = analyzeUrl(destination.origin);
    for (const finding of address.findings) {
      if (!selectedSignals.has(finding.id) || finding.level !== 'review') continue;
      if (finding.id === 'http' && page.protocol !== 'https:') continue;
      note(`link-${finding.id}`, `Link: ${finding.title}`, host, finding.why, finding.suggestion);
    }
    if (link.hasUserInfo) note('link-userinfo', 'Link address contains username / @ syntax', host,
      'The address contains user information before its actual hostname. Credentials are omitted.', 'Check the actual receiving hostname.');
    if (mismatch && sensitiveOffsiteHttp.has(destination.origin) && address.findings.some(finding => finding.id === 'brand-mismatch')) strongCombination = true;
  }
  for (const [id, group] of groups) add(id, 'review', `${group.title} (${group.count})`, [...group.samples].join('; '), group.why, group.suggestion);
  if (strongCombination) add('page-combination', 'review', 'Several signals share one destination',
    'A sensitive form targets HTTP on another origin, and a misleading link targets that same origin with a brand-like unrelated hostname.',
    'These structural signals together justify closer review. They do not prove abuse or reveal where scripts actually send data.', 'Verify the intended service before entering private information.');
  if (raw.frames.inspected) add('iframes', 'info', 'Embedded frames present',
    `Iframe elements inspected: ${raw.frames.inspected}. Sources pointing to other origins: ${raw.frames.crossOrigin}. Inline, blank, or non-HTTP sources that cannot be compared: ${raw.frames.unknown}.`,
    'Frames often support video, login, ads, or checkout. Source attributes do not reveal current frame contents, sandbox origins, or activity. No frame documents were read.', 'Consider whether the embedded features fit this page.');
  if (raw.externalHostCount >= 20) add('external-hosts', 'info', 'Several external hostnames referenced', `${raw.externalHostCount} other hostnames appear in inspected links/resources (threshold: 20).`,
    'Different hostnames can belong to the same organization. DOM references do not prove requests happened or identify trackers.', 'Review the page context; references alone do not establish misuse.');
  if (raw.capped) add('scan-capped', 'info', 'Snapshot limits reached', 'Only the bounded first portion of this page was inspected.',
    'Large pages can exceed scan limits. Results are a partial snapshot, not a complete page assessment.', 'Review important links and form destinations yourself.');
  const reviewCount = findings.filter(finding => finding.level === 'review').length;
  return { available: true, domain: page.hostname, status: strongCombination ? 'High Attention' : reviewCount ? 'Review' : 'Normal',
    reviewCount, findings, message: `${reviewCount} review signals. ${raw.forms.length} forms and ${raw.links.length} distinct destination/label patterns checked from ${raw.linksInspected} inspected links. A snapshot, not proof of behavior.` };
}
