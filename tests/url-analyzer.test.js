import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeUrl } from '../src/analysis/url-analyzer.js';

const has = (result, id) => result.findings.some(finding => finding.id === id);

test('official brands and real subdomains are not impersonation signals', () => {
  for (const host of ['google.com', 'accounts.google.com', 'GOOGLE.COM.', 'microsoft.com', 'facebook.com', 'paypal.com', 'bkash.com', 'nagad.com.bd', 'pay.bkash.com']) {
    const result = analyzeUrl(`https://${host}`);
    assert.equal(has(result, 'brand-mismatch'), false, host);
    assert.equal(result.status, 'Normal', host);
  }
});

test('brand references in unrelated names mean review, not confirmed phishing', () => {
  for (const host of ['google-login-example.com', 'bkash-login-example.com', 'nagad-wallet-example.com', 'google.com.example.org', 'notgoogle.com.google.example.org']) {
    const result = analyzeUrl(`https://${host}`);
    assert.equal(has(result, 'brand-mismatch'), true, host);
    assert.equal(result.status, 'Review', host);
    assert.match(result.findings.find(f => f.id === 'brand-mismatch').why, /not confirmed phishing/);
  }
  assert.equal(has(analyzeUrl('https://notgoogle.com'), 'brand-mismatch'), false);
});

test('HTTPS alone is not safety and HTTP alone is not malware', () => {
  const https = analyzeUrl('https://example.com');
  assert.match(https.findings[0].why, /does not.*prove/);
  const http = analyzeUrl('http://example.com');
  assert.equal(http.status, 'Review');
  assert.match(http.findings[0].why, /does not mean.*malware/);
});

test('ordinary domains accumulate no arbitrary warnings', () => {
  for (const input of ['https://example.com', 'https://www.example.org/about', 'https://news.example.net', 'https://example.com:443']) {
    const result = analyzeUrl(input);
    assert.equal(result.status, 'Normal');
    assert.deepEqual(result.findings.map(f => f.id), ['https']);
  }
});

test('sensitive words are informational alone, and matching uses word boundaries', () => {
  for (const word of ['login', 'verify', 'account', 'secure', 'payment', 'wallet', 'otp', 'password', 'update', 'recovery']) {
    const result = analyzeUrl(`https://example.com/${word}`);
    assert.equal(result.status, 'Normal');
    assert.equal(has(result, 'sensitive-words'), true);
  }
  assert.equal(has(analyzeUrl('https://example.com/updater?note=hotpot'), 'sensitive-words'), false);
  assert.equal(has(analyzeUrl('https://example.com/%6cogin'), 'sensitive-words'), true);
  assert.equal(has(analyzeUrl('https://example.com/?action=verify'), 'sensitive-words'), true);
});

test('High Attention has an explicit combination rule', () => {
  for (const input of ['http://example.com/login', 'http://google-example.com', 'http://user@example.com']) {
    assert.equal(analyzeUrl(input).status, 'High Attention', input);
  }
  assert.equal(analyzeUrl('https://example.com/login').status, 'Normal');
  assert.equal(analyzeUrl('http://localhost:3000/login').status, 'Normal');
});

test('public IP addresses include an explanation, including canonicalized IPs', () => {
  for (const host of ['8.8.8.8', '[2001:4860:4860::8888]', '0x08080808']) {
    const result = analyzeUrl(`https://${host}`);
    assert.equal(result.status, 'Review');
    assert.equal(has(result, 'internal'), false);
    assert.match(result.findings.find(f => f.id === 'ip-address').why, /Legitimate services/);
  }
});

test('localhost, private IPv4, IPv6 and internal names receive calm context', () => {
  for (const host of ['localhost', 'app.localhost', 'router', 'printer.local', 'app.internal', '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.254', '192.168.1.1', '169.254.1.1', '100.64.1.1', '[::1]', '[::]', '[fd00::1]', '[fe80::1]', '[::ffff:192.168.1.1]']) {
    const result = analyzeUrl(`http://${host}:8080/login`);
    assert.equal(has(result, 'internal'), true, host);
    assert.equal(result.status, 'Normal', host);
  }
  for (const host of ['172.15.0.1', '172.32.0.1', '100.63.1.1', 'localhost.example.com', '[::ffff:8.8.8.8]']) {
    assert.equal(has(analyzeUrl(`https://${host}`), 'internal'), false, host);
  }
});

test('punycode and Unicode hostnames are detected', () => {
  for (const host of ['xn--bcher-kva.de', 'bücher.de']) {
    assert.equal(has(analyzeUrl(`https://${host}`), 'punycode'), true);
  }
});

test('known shorteners and their subdomains match with a dot boundary', () => {
  for (const host of ['bit.ly', 't.co', 'tinyurl.com', 'go.bit.ly']) {
    assert.equal(has(analyzeUrl(`https://${host}/example`), 'shortener'), true);
  }
  assert.equal(has(analyzeUrl('https://notbit.ly'), 'shortener'), false);
  assert.equal(has(analyzeUrl('https://bit.ly.example.com'), 'shortener'), false);
});

test('length and depth thresholds are deterministic', () => {
  assert.equal(has(analyzeUrl(`https://${'a'.repeat(56)}.com`), 'long-hostname'), false);
  assert.equal(has(analyzeUrl(`https://${'a'.repeat(57)}.com`), 'long-hostname'), true);
  assert.equal(has(analyzeUrl('https://a.b.c.example.com'), 'deep-hostname'), false);
  assert.equal(has(analyzeUrl('https://a.b.c.d.example.com'), 'deep-hostname'), true);
});

test('ports distinguish scheme defaults from non-standard explicit ports', () => {
  for (const input of ['https://example.com:443', 'http://example.com:80']) {
    assert.equal(has(analyzeUrl(input), 'nonstandard-port'), false);
  }
  for (const input of ['https://example.com:80', 'http://example.com:443', 'https://example.com:8443']) {
    assert.equal(has(analyzeUrl(input), 'nonstandard-port'), true);
  }
});

test('userinfo is flagged without revealing credentials or a misleading host', () => {
  const result = analyzeUrl('https://google.com:private-test-value@unrelated.example/login?token=private-query#private-fragment');
  assert.equal(result.domain, 'unrelated.example');
  assert.equal(has(result, 'userinfo'), true);
  assert.doesNotMatch(JSON.stringify(result), /private-test-value|private-query|private-fragment/);
  assert.equal(has(analyzeUrl('https://@example.com'), 'userinfo'), true);
  assert.equal(has(analyzeUrl('https://example.com/email@home'), 'userinfo'), false);
});

test('malformed and unsupported input fails safely without echoing input', () => {
  for (const input of [undefined, null, 4, {}, '', 'bad-secret-value', 'https://', 'https://[bad]', 'https://example.com:99999', 'chrome://extensions', 'file:///private/secret', 'javascript:alert(1)', 'about:blank']) {
    const result = analyzeUrl(input);
    assert.equal(result.available, false);
    assert.equal(result.status, 'Review');
    assert.equal(result.domain, null);
    assert.doesNotMatch(JSON.stringify(result), /bad-secret-value|private\/secret/);
  }
});

test('analysis is repeatable and every finding has all explanation fields', () => {
  const input = 'http://bkash-login-example.com:8080';
  const result = analyzeUrl(input);
  assert.deepEqual(analyzeUrl(input), result);
  for (const finding of result.findings) {
    for (const field of ['id', 'title', 'detected', 'why', 'suggestion']) {
      assert.equal(typeof finding[field], 'string');
      assert.ok(finding[field].length);
    }
  }
});
