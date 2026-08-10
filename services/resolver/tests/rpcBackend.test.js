'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const ethers = require('ethers');
const {
  RpcBackend,
  didToUint128,
  uint128ToDID,
  toDidDocumentShape,
} = require('../service/backends/rpc');
const { Resolver } = require('../service/resolver');

const DID = 'did:xny:95228308-9d75-4dd8-8958-2713b92d3d71';
const OTHER_DID = 'did:xny:00000000-0000-0000-0000-00000000002a';
const OWNER = '0x00000000000000000000000000000000000000ab';

const bytes = (s) => ethers.hexlify(ethers.toUtf8Bytes(s));
const item = (value, revoked = false) => ({ value: bytes(value), revoked });
const attribute = (name, values) => ({ name, values });

// Real ethers Result objects, not plain ones: Result extends Array, so a struct member
// named `values` is shadowed by Array.prototype.values and named access returns the
// iterator. A hand-rolled object stub hides that and lets the backend read a function.
const onChainAttribute = (name, values) =>
  ethers.Result.fromItems(
    [
      name,
      ethers.Result.fromItems(
        values.map((v) =>
          ethers.Result.fromItems([v.value, v.revoked], ['value', 'revoked'])
        )
      ),
    ],
    ['name', 'values']
  );

// Stands in for the ethers Contract; the tuple order matches getDidDocument's returns.
function stubRegistry(owner, controller, arrayAttributes) {
  return {
    getDidDocument: async () =>
      ethers.Result.fromItems(
        [
          0n,
          owner,
          ethers.Result.fromItems(controller),
          ethers.Result.fromItems([]),
          ethers.Result.fromItems(
            arrayAttributes.map((a) => onChainAttribute(a.name, a.values))
          ),
        ],
        ['id', 'owner', 'controller', 'kvAttributes', 'arrayAttributes']
      ),
  };
}

function backendReturning(owner, controller, arrayAttributes) {
  const backend = new RpcBackend();
  backend.registry = stubRegistry(owner, controller, arrayAttributes);
  return backend;
}

test('didToUint128 / uint128ToDID round-trip', () => {
  assert.equal(uint128ToDID(didToUint128(DID)), DID);
  assert.equal(didToUint128(OTHER_DID), 42n);
  // Leading zeros must survive; a naive hex conversion would shorten the first group.
  assert.equal(uint128ToDID(42n), OTHER_DID);
});

test('uppercase hex in the identifier resolves to the same uint128', () => {
  assert.equal(didToUint128(DID.toUpperCase().replace('DID:XNY:', 'did:xny:')), didToUint128(DID));
});

test('unregistered DID -> null (getDidDocument returns a zeroed struct, it does not revert)', async () => {
  const backend = backendReturning(ethers.ZeroAddress, [], []);
  assert.equal(await backend.fetch(DID), null);
});

test('self DID is prepended to the on-chain controller set', async () => {
  const backend = backendReturning(OWNER, [42n], []);
  const doc = await backend.fetch(DID);
  assert.deepEqual(doc.controllers, [DID, OTHER_DID]);
});

test('owner is lowercased to match the subgraph Bytes rendering', async () => {
  const checksummed = ethers.getAddress(OWNER);
  const backend = backendReturning(checksummed, [], []);
  const doc = await backend.fetch(DID);
  assert.equal(doc.owner, OWNER);
});

test('a revoked item keeps its slot, so later ids keep their index', () => {
  const doc = toDidDocumentShape(DID, OWNER, [DID], [
    attribute('verificationMethod', [
      item('{"type":"Ed25519VerificationKey2020"}'),
      item('{"type":"Ed25519VerificationKey2020"}', true),
      item('{"type":"Ed25519VerificationKey2020"}'),
    ]),
  ]);
  assert.deepEqual(
    doc.verificationMethod.map((vm) => vm.id),
    [`${DID}#vm_0`, `${DID}#vm_2`]
  );
});

test('verification method without a string type is dropped, as the indexer drops it', () => {
  const doc = toDidDocumentShape(DID, OWNER, [DID], [
    attribute('verificationMethod', [
      item('{"controller":1}'),
      item('{"type":7}'),
      item('not json'),
      item('{"type":"Ed25519VerificationKey2020"}'),
    ]),
  ]);
  assert.deepEqual(
    doc.verificationMethod.map((vm) => vm.id),
    [`${DID}#vm_3`]
  );
});

test('relation values: numeric -> vm reference, DID -> itself, object -> null uri', () => {
  const doc = toDidDocumentShape(DID, OWNER, [DID], [
    attribute('authentication', [
      item('0'),
      item(OTHER_DID),
      item('{"type":"Ed25519VerificationKey2020"}'),
      item('neither'),
    ]),
  ]);
  assert.deepEqual(doc.authentication, [
    { id: `${DID}#auth_0`, uri: `${DID}#vm_0` },
    { id: `${DID}#auth_1`, uri: OTHER_DID },
    // An object value is stored as an embedded method and leaves uri null upstream.
    { id: `${DID}#auth_2`, uri: null },
  ]);
});

test('every relation gets its own id prefix', () => {
  const doc = toDidDocumentShape(DID, OWNER, [DID], [
    attribute('assertionMethod', [item('0')]),
    attribute('keyAgreement', [item('0')]),
    attribute('capabilityInvocation', [item('0')]),
    attribute('capabilityDelegation', [item('0')]),
  ]);
  assert.equal(doc.assertionMethod[0].id, `${DID}#am_0`);
  assert.equal(doc.keyAgreement[0].id, `${DID}#ka_0`);
  assert.equal(doc.capabilityInvocation[0].id, `${DID}#ci_0`);
  assert.equal(doc.capabilityDelegation[0].id, `${DID}#cd_0`);
});

test('alsoKnownAs: absent stays null, present dedupes and skips revoked', () => {
  assert.equal(toDidDocumentShape(DID, OWNER, [DID], []).alsoKnownAs, null);

  const doc = toDidDocumentShape(DID, OWNER, [DID], [
    attribute('alsoKnownAs', [
      item('https://example.com/a'),
      item('https://example.com/a'),
      item('https://example.com/b', true),
      item('https://example.com/c'),
    ]),
  ]);
  assert.deepEqual(doc.alsoKnownAs, [
    'https://example.com/a',
    'https://example.com/c',
  ]);
});

test('alsoKnownAs with every item revoked is an empty list, not null', () => {
  const doc = toDidDocumentShape(DID, OWNER, [DID], [
    attribute('alsoKnownAs', [item('https://example.com/a', true)]),
  ]);
  assert.deepEqual(doc.alsoKnownAs, []);
});

test('service keeps the raw value as serviceEndpoint and needs both fields', () => {
  const value = '{"type":"LinkedDomains","serviceEndpoint":"https://example.com"}';
  const doc = toDidDocumentShape(DID, OWNER, [DID], [
    attribute('service', [
      item('{"type":"LinkedDomains"}'),
      item(value),
    ]),
  ]);
  assert.deepEqual(doc.service, [
    { id: `${DID}#service_1`, type: 'LinkedDomains', serviceEndpoint: bytes(value) },
  ]);
});

test('@context and kv attributes are ignored, matching the subgraph', () => {
  const doc = toDidDocumentShape(DID, OWNER, [DID], [
    attribute('@context', [item('https://example.com/ctx')]),
  ]);
  assert.equal(doc['@context'], undefined);
  assert.equal(doc.context, undefined);
});

test('end to end through Resolver: rpc backend produces a W3C DID Document', async () => {
  const vmValue = '{"type":"Ed25519VerificationKey2020","publicKeyMultibase":"z6Mk"}';
  const backend = backendReturning(OWNER, [42n], [
    attribute('verificationMethod', [item(vmValue)]),
    attribute('authentication', [item('0')]),
  ]);
  const doc = await new Resolver(backend).resolve(DID);

  assert.deepEqual(doc['@context'], ['https://www.w3.org/ns/did/v1']);
  assert.equal(doc.id, DID);
  assert.deepEqual(doc.controller, [DID, OTHER_DID]);
  assert.equal(doc.owner, OWNER);
  assert.deepEqual(doc.verificationMethod, [
    {
      id: `${DID}#vm_0`,
      type: 'Ed25519VerificationKey2020',
      controller: DID,
      publicKeyMultibase: 'z6Mk',
    },
  ]);
  assert.deepEqual(doc.authentication, [`${DID}#vm_0`]);
});

test('rpc transport failure -> 500 internalError', async () => {
  const backend = new RpcBackend();
  backend.registry = {
    getDidDocument: async () => {
      throw new Error('connection refused');
    },
  };
  await assert.rejects(
    () => new Resolver(backend).resolve(DID),
    (e) => e.status === 500 && e.code === 'internalError'
  );
});

test('rpc backend defaults to public Base mainnet with no configuration', () => {
  const backend = new RpcBackend();
  assert.equal(backend.rpcUrl, 'https://mainnet.base.org');
  assert.equal(backend.registryAddress, '0xf73eD23b998b3987503F4F4Ba4eAb85386ebfCC4');
  assert.equal(backend.chainId, 8453);
  assert.equal(backend.timeoutMs, 10000);
});
