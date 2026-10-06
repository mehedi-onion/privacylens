// A dot boundary prevents google.com.example.org from matching google.com.
export function matchesDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function findBrandReferences(hostname, brands) {
  const tokens = hostname.split(/[.-]/);
  return brands.filter(brand =>
    tokens.includes(brand.name.toLowerCase()) &&
    !brand.domains.some(domain => matchesDomain(hostname, domain))
  );
}
