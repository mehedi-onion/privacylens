export function explainHostPattern(pattern) {
  if (pattern === '<all_urls>') {
    return { pattern, recognized: true, broad: true,
      explanation: 'Host permission across many supported website addresses. This may be expected for blockers or password managers, but it is broad access.',
      recommendation: 'Review whether access across many websites is needed. Browser site-access controls can still restrict where it runs.' };
  }
  const match = typeof pattern === 'string' && pattern.match(/^(\*|https?|file):\/\/([^/]*)(\/.*)$/);
  const hostWithPort = match?.[2];
  const hostParts = hostWithPort?.match(/^(.*?)(?::(\*|\d+))?$/);
  const host = hostParts?.[1];
  const port = hostParts?.[2];
  const domain = host?.startsWith('*.') ? host.slice(2) : host;
  const validDomain = typeof domain === 'string' && domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label));
  const validHost = match?.[1] === 'file' ? host === '' || host === '*'
    : host === '*' || validDomain || /^\[[0-9a-f:]+\]$/i.test(host ?? '');
  const validPort = port === undefined || (match?.[1] !== 'file' && (port === '*' || Number(port) <= 65535));
  if (!match || !validHost || !validPort) {
    return { pattern, recognized: false, broad: false,
      explanation: 'This host pattern is not recognized by the local explanation rules.',
      recommendation: 'Review the address pattern in the browser’s extension details.' };
  }
  const [, scheme] = match;
  const broad = host === '*' && scheme !== 'file';
  const explanation = scheme === 'file'
    ? 'A local-file address pattern. Chrome separately controls whether an extension may access file URLs.'
    : broad
      ? `Host permission for many websites using ${scheme === '*' ? 'HTTP or HTTPS' : scheme.toUpperCase()}. Browser site-access controls may restrict its actual reach.`
      : `Host permission for ${host.startsWith('*.') ? `${host.slice(2)} and its subdomains` : host} using ${scheme === '*' ? 'HTTP or HTTPS' : scheme.toUpperCase()}.`;
  return { pattern, recognized: true, broad, explanation,
    recommendation: 'Chrome ignores paths for host permissions. Compare the host, scheme, and any port scope shown in the pattern with the extension’s purpose.' };
}
