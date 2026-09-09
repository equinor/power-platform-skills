'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { createRequire } = require('node:module');
const vm = require('node:vm');
const { cacheMatchesTarget, canUseCachedResolution, toEnvironmentResult, environmentFromPowerPlatformPayload } = require('../resolve-environment');

const environmentId = '11111111-1111-4111-8111-111111111111';

test('environment resolution preserves cluster routing metadata through cache serialization', () => {
  for (const metadata of [{ location: 'unitedstatesfirstrelease', properties: {} }, { properties: { location: 'europe' } }]) {
    const resolved = environmentFromPowerPlatformPayload({
      ...metadata,
      name: environmentId,
      properties: {
        ...metadata.properties,
        linkedEnvironmentMetadata: { instanceUrl: 'https://contoso.crm4.dynamics.com' },
        cluster: { environment: 'Prod', geoShortName: 'EU', category: 'FirstRelease' },
      },
    }, environmentId);
    assert.equal(resolved.environmentId, environmentId);
    assert.equal(Object.hasOwn(resolved, 'organizationId'), false);
    assert.equal(resolved.clusterEnvironment, 'Prod');
    assert.equal(resolved.clusterGeoName, 'EU');
    assert.equal(toEnvironmentResult(resolved, 'cache').clusterEnvironment, 'Prod');
    assert.equal(toEnvironmentResult(resolved, 'cache').clusterGeoName, 'EU');
    assert.equal(Object.hasOwn(resolved, 'location'), false);
    assert.equal(Object.hasOwn(toEnvironmentResult({ ...resolved, location: 'europe' }, 'cache'), 'location'), false);
    assert.equal(cacheMatchesTarget(resolved, environmentId), true);
    assert.equal(cacheMatchesTarget(resolved, '22222222-2222-4222-8222-222222222222'), false);
  }
  for (const cluster of [undefined, null, { category: 'FirstRelease' }, { environment: ['Prod'], geoShortName: ['EU'] }]) {
    const resolved = environmentFromPowerPlatformPayload({
      name: environmentId, properties: { cluster },
    }, environmentId);
    assert.equal(resolved.clusterEnvironment, null);
    assert.equal(resolved.clusterGeoName, null);
  }
  assert.equal(Object.hasOwn(toEnvironmentResult({}, 'cache'), 'location'), false);
  assert.equal(toEnvironmentResult({}, 'cache').clusterEnvironment, null);
  assert.equal(toEnvironmentResult({}, 'cache').clusterGeoName, null);
});

test('old ID caches refresh for cluster metadata while URL caches remain compatible', () => {
  const cached = { environmentId, environmentUrl: 'https://contoso.crm4.dynamics.com', tenantId: environmentId };
  assert.equal(canUseCachedResolution(cached, environmentId), false);
  assert.equal(canUseCachedResolution(cached, environmentId, 'eu'), true);
  assert.equal(canUseCachedResolution(null, environmentId, 'eu'), false);
  assert.equal(canUseCachedResolution({ ...cached, location: 'europe' }, environmentId), false);
  assert.equal(canUseCachedResolution({ ...cached, clusterEnvironment: 'Prod', clusterGeoName: 'EU' }, environmentId), true);
  assert.equal(canUseCachedResolution({ ...cached, clusterGeoName: 'EU' }, environmentId), false);
  assert.equal(canUseCachedResolution({ ...cached, clusterEnvironment: 'Prod', clusterGeoName: ' ' }, environmentId), false);
  assert.equal(canUseCachedResolution(cached, cached.environmentUrl), true);
});

// Equinor fork: upstream also asserts that resolution publishes a telemetry cluster
// into app.json. That write lives in the excluded telemetry stack, so only the
// environment-cache and auth-config behaviour is covered here.
test('failed cluster metadata refresh preserves connection details and auth settings', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-env-cache-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cached = { environmentId, environmentUrl: 'https://contoso.crm4.dynamics.com', tenantId: environmentId, displayName: 'Example' };
  fs.writeFileSync(path.join(root, '.resolved-environment.json'), JSON.stringify({ ...cached, location: 'europe' }));
  fs.writeFileSync(path.join(root, 'auth.config.json'), JSON.stringify({ msal: { clientId: 'preserve' } }));
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../resolve-environment.js'), environmentId], {
    cwd: root, encoding: 'utf8', timeout: 5000, env: { ...process.env, PATH: '' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { ...cached, clusterEnvironment: null, clusterGeoName: null, source: 'cache-refresh' });
  const auth = JSON.parse(fs.readFileSync(path.join(root, 'auth.config.json'), 'utf8'));
  assert.equal(auth.msal.clientId, 'preserve');
  assert.equal(auth.environment.environmentId, environmentId);
  assert.equal(Object.hasOwn(auth.environment, 'location'), false);
  assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(path.join(root, '.resolved-environment.json'), 'utf8')), 'location'), false);

  cached.clusterEnvironment = 'Prod';
  cached.clusterGeoName = 'EU';
  fs.writeFileSync(path.join(root, '.resolved-environment.json'), JSON.stringify(cached));
  const hit = spawnSync(process.execPath, [path.resolve(__dirname, '../resolve-environment.js'), environmentId], {
    cwd: root, encoding: 'utf8', timeout: 5000, env: { ...process.env, PATH: '' },
  });
  assert.equal(hit.status, 0, hit.stderr);
  assert.deepEqual(JSON.parse(hit.stdout), { ...cached, source: 'cache' });

  const failed = spawnSync(process.execPath, [path.resolve(__dirname, '../resolve-environment.js'), '22222222-2222-4222-8222-222222222222'], {
    cwd: root, encoding: 'utf8', timeout: 5000, env: { ...process.env, PATH: '' },
  });
  assert.equal(failed.status, 1);
});

test('a valid saved cluster avoids metadata refresh and is never overwritten', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-env-saved-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const appPath = path.join(root, 'app.json');
  const app = JSON.stringify({ expo: { name: 'demo', extra: { telemetry: { cluster: 'eu' } } } });
  fs.writeFileSync(appPath, app);
  for (const clusterGeoName of [null, 'US', 'unknown']) {
    const cached = { environmentId, environmentUrl: 'https://contoso.crm4.dynamics.com', tenantId: environmentId, clusterEnvironment: 'Prod', clusterGeoName };
    fs.writeFileSync(path.join(root, '.resolved-environment.json'), JSON.stringify(cached));
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../resolve-environment.js'), environmentId], {
      cwd: root, encoding: 'utf8', timeout: 5000, env: { ...process.env, PATH: '' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).source, 'cache');
    assert.equal(fs.readFileSync(appPath, 'utf8'), app);
  }
});

test('missing or unknown cluster metadata never falls back to provisioning location', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-env-unresolved-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const appPath = path.join(root, 'app.json');
  const app = JSON.stringify({ expo: { extra: { telemetry: { cluster: null } } } });
  fs.writeFileSync(appPath, app);
  for (const clusterMetadata of [
    {}, { clusterEnvironment: 'Prod' }, { clusterGeoName: 'US' },
    { clusterEnvironment: 'unknown', clusterGeoName: 'US' },
    { clusterEnvironment: 'Prod', clusterGeoName: 'unknown' },
  ]) {
    fs.writeFileSync(path.join(root, '.resolved-environment.json'), JSON.stringify({
      environmentId, environmentUrl: 'https://contoso.crm.dynamics.com', tenantId: environmentId,
      location: 'unitedstatesfirstrelease', ...clusterMetadata,
    }));
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../resolve-environment.js'), environmentId], {
      cwd: root, encoding: 'utf8', timeout: 5000, env: { ...process.env, PATH: '' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(Object.hasOwn(JSON.parse(result.stdout), 'location'), false);
    assert.equal(fs.readFileSync(appPath, 'utf8'), app);
  }
});

// Equinor fork: upstream's remaining cases in this file exercise
// scripts/lib/telemetry/region/region-resolver.js, which is part of the excluded
// telemetry stack. They are dropped here rather than left failing.
