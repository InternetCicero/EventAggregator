const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isPrivateAddress, assertPublicUrl } = require('../src/scraper/extractFromUrl');

test('isPrivateAddress: erkennt private IPv4-Bereiche', () => {
  assert.equal(isPrivateAddress('10.0.0.5'), true);
  assert.equal(isPrivateAddress('127.0.0.1'), true);
  assert.equal(isPrivateAddress('169.254.1.1'), true);
  assert.equal(isPrivateAddress('172.16.0.1'), true);
  assert.equal(isPrivateAddress('172.31.255.255'), true);
  assert.equal(isPrivateAddress('192.168.1.1'), true);
  assert.equal(isPrivateAddress('0.0.0.0'), true);
});

test('isPrivateAddress: lässt öffentliche IPv4-Adressen durch', () => {
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  assert.equal(isPrivateAddress('172.32.0.1'), false); // knapp außerhalb von 172.16-31
  assert.equal(isPrivateAddress('172.15.255.255'), false);
});

test('isPrivateAddress: erkennt private/lokale IPv6-Adressen', () => {
  assert.equal(isPrivateAddress('::1'), true);
  assert.equal(isPrivateAddress('fe80::1'), true);
  assert.equal(isPrivateAddress('fc00::1'), true);
  assert.equal(isPrivateAddress('fd12:3456::1'), true);
});

test('isPrivateAddress: lässt öffentliche IPv6-Adressen durch', () => {
  assert.equal(isPrivateAddress('2a00:1450:4001::1'), false);
});

test('assertPublicUrl: lehnt ungültige URLs ab', async () => {
  await assert.rejects(() => assertPublicUrl('nicht-mal-eine-url'), /Ungültige URL/);
});

test('assertPublicUrl: erlaubt nur http/https', async () => {
  await assert.rejects(() => assertPublicUrl('file:///etc/passwd'), /Nur http\/https/);
  await assert.rejects(() => assertPublicUrl('ftp://example.com'), /Nur http\/https/);
});

test('assertPublicUrl: blockiert localhost', async () => {
  await assert.rejects(() => assertPublicUrl('http://localhost/'), /Lokale Adressen/);
});

test('assertPublicUrl: lässt eine echte öffentliche Domain durch', async () => {
  const result = await assertPublicUrl('https://example.com/pfad');
  assert.equal(result.hostname, 'example.com');
});
