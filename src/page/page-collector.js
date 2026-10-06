// Self-contained: Chrome serializes this function into its isolated world.
// Only structural attributes and eligible link labels are read. No field values.
export function collectPageMetadata(brandNames = [], doc = document, pageAddress = location.href) {
  const limits = { forms: 50, inputs: 400, controlsPerForm: 100, links: 400, destinations: 200, frames: 100, resources: 400, domains: 100 };
  const page = new URL(pageAddress);
  if (!['http:', 'https:'].includes(page.protocol)) return null;
  let capped = false;
  const externalHosts = new Set();
  const cleanHost = host => host.toLowerCase().replace(/\.$/, '');
  function webAddress(raw, base) {
    try {
      const url = new URL(raw, base);
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      return { origin: url.origin, host: cleanHost(url.hostname), hasUserInfo: Boolean(url.username || url.password) };
    } catch { return null; }
  }
  function noteHost(address) {
    if (!address || address.host === cleanHost(page.hostname)) return;
    if (externalHosts.size < limits.domains) externalHosts.add(address.host);
    else if (!externalHosts.has(address.host)) capped = true;
  }
  function bounded(collection, cap) {
    if (collection.length > cap) capped = true;
    return Array.prototype.slice.call(collection, 0, cap);
  }
  function fieldFlags(control) {
    const type = (control.getAttribute('type') || '').toLowerCase();
    const tokens = (control.getAttribute('autocomplete') || '').toLowerCase().split(/\s+/);
    return { password: type === 'password',
      authentication: type === 'password' || tokens.some(token => ['username', 'current-password', 'new-password', 'one-time-code'].includes(token)),
      payment: tokens.some(token => ['cc-name', 'cc-given-name', 'cc-family-name', 'cc-number', 'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-csc', 'cc-type', 'transaction-amount', 'transaction-currency'].includes(token)) };
  }
  function destination(action, method) {
    if (method.toLowerCase() === 'dialog') return { kind: 'dialog' };
    const address = webAddress(action?.trim() || pageAddress, doc.baseURI);
    if (!address) return { kind: 'unavailable' };
    return { kind: 'web', origin: address.origin, hasUserInfo: address.hasUserInfo };
  }
  let passwordFields = 0;
  for (const input of bounded(doc.querySelectorAll('input'), limits.inputs)) {
    if ((input.getAttribute('type') || '').toLowerCase() === 'password') passwordFields++;
  }
  const forms = bounded(doc.forms, limits.forms).map(form => {
    const flags = { password: false, authentication: false, payment: false };
    const method = form.getAttribute('method') || 'get';
    const destinations = [destination(form.getAttribute('action'), method)];
    for (const control of bounded(form.elements, limits.controlsPerForm)) {
      const metadata = fieldFlags(control);
      for (const key of Object.keys(flags)) flags[key] ||= metadata[key];
      if (control.hasAttribute('formaction')) {
        destinations.push(destination(control.getAttribute('formaction'), control.getAttribute('formmethod') || method));
      }
    }
    const seen = new Set();
    return { ...flags, destinations: destinations.filter(item => {
      const key = `${item.kind}|${item.origin || ''}|${item.hasUserInfo || false}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }) };
  });
  const links = [];
  const seenLinks = new Set();
  let linksInspected = 0;
  for (const anchor of bounded(doc.querySelectorAll('a[href]'), limits.links)) {
    linksInspected++;
    const address = webAddress(anchor.getAttribute('href'), doc.baseURI);
    if (!address) continue;
    noteHost(address);
    let claimedHost = null;
    let claimedBrands = [];
    // Do not read form contents, editable labels, or labels containing controls.
    if (anchor.getClientRects().length && doc.defaultView.getComputedStyle(anchor).visibility === 'visible' &&
        !anchor.closest('form, [contenteditable], [role="textbox"]') &&
        !anchor.querySelector('input, textarea, select, button, form, [contenteditable], [role="textbox"]')) {
      const text = anchor.innerText.trim();
      if (text.length <= 300) {
        const match = text.match(/^(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z][a-z0-9-]*)(?::\d+)?(?:\/[^\s]*)?$/i);
        if (match) claimedHost = cleanHost(match[1]);
        const words = text.toLowerCase().split(/[^a-z]+/);
        claimedBrands = brandNames.filter(name => words.includes(name.toLowerCase()));
      }
    }
    const key = `${address.origin}|${claimedHost || ''}|${claimedBrands.join(',')}|${address.hasUserInfo}`;
    if (seenLinks.has(key)) continue;
    if (links.length >= limits.destinations) { capped = true; continue; }
    seenLinks.add(key);
    links.push({ origin: address.origin, hasUserInfo: address.hasUserInfo, claimedHost, claimedBrands });
  }
  const frameNodes = bounded(doc.querySelectorAll('iframe'), limits.frames);
  let crossOriginFrames = 0;
  let unknownFrames = 0;
  for (const frame of frameNodes) {
    const source = frame.getAttribute('src');
    const address = frame.hasAttribute('srcdoc') || !source ? null : webAddress(source, doc.baseURI);
    if (!address) { unknownFrames++; continue; }
    noteHost(address);
    if (address.origin !== page.origin) crossOriginFrames++;
  }
  for (const resource of bounded(doc.querySelectorAll('script[src], img[src], link[href], source[src], video[src], audio[src]'), limits.resources)) {
    noteHost(webAddress(resource.getAttribute('src') || resource.getAttribute('href'), doc.baseURI));
  }
  return { origin: page.origin, passwordFields, forms, links, linksInspected,
    frames: { inspected: frameNodes.length, crossOrigin: crossOriginFrames, unknown: unknownFrames },
    externalHostCount: externalHosts.size, capped, limits };
}
