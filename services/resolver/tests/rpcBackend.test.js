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

test('an upper-case identifier resolves to a wholly lower-case document', async () => {
  // Both spellings are the same DID and lowercase is canonical
  // (docs/xny-did-method.md:73-86). Echoing the caller's casing back would emit a document
  // whose own id disagrees with the controller entries rebuilt from chain state, and would
  // resolve under this backend while the subgraph answered 404.
  const upper = DID.toUpperCase().replace('DID:XNY:', 'did:xny:');
  const backend = backendReturning(OWNER, [42n], [
    attribute('verificationMethod', [item('{"type":"Ed25519VerificationKey2020"}')]),
  ]);
  const doc = await new Resolver(backend).resolve(upper);

  assert.equal(doc.id, DID);
  assert.deepEqual(doc.controller, [DID, OTHER_DID]);
  assert.equal(doc.verificationMethod[0].id, `${DID}#vm_0`);
  // Nothing anywhere in the document may carry the caller's spelling.
  for (const match of JSON.stringify(doc).match(/did:xny:[^"#]*/g)) {
    assert.equal(match, match.toLowerCase());
  }
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

// The backend's job is to reproduce what the subgraph stores, which for a service
// is the whole blob — Resolver's assembly is what decodes it, so both backends get
// the same treatment. The end-to-end expectation is asserted below and mirrored in
// tests/resolver.test.js for the subgraph path.
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

test('@context is ignored entirely, matching the subgraph', () => {
  const doc = toDidDocumentShape(DID, OWNER, [DID], [
    attribute('@context', [item('https://example.com/ctx')]),
  ]);
  // Not just absent under those two names — the attribute must leave no trace at all,
  // which is only meaningful if the rest of the document is what an empty DID looks like.
  assert.deepEqual(doc, {
    id: DID,
    owner: OWNER,
    controllers: [DID],
    verificationMethod: [],
    alsoKnownAs: null,
    service: [],
    authentication: [],
    assertionMethod: [],
    keyAgreement: [],
    capabilityInvocation: [],
    capabilityDelegation: [],
  });
});

// arrayAttributeHandler.ts:95-118 rejects the whole entry when controller is present but
// is neither an integral number nor a string, so no entity reaches the subgraph.
for (const [label, controller] of [
  ['null', 'null'],
  ['a float', '1.5'],
  ['a bool', 'true'],
  ['an array', '[]'],
  ['a non-numeric string', '"not-a-number"'],
]) {
  test(`method with ${label} as controller is dropped, as the indexer drops it`, () => {
    const value = `{"type":"Ed25519VerificationKey2020","controller":${controller}}`;
    const doc = toDidDocumentShape(DID, OWNER, [DID], [
      attribute('verificationMethod', [item(value)]),
      attribute('authentication', [item(value)]),
    ]);
    assert.deepEqual(doc.verificationMethod, []);
    assert.deepEqual(doc.authentication, []);
  });
}

for (const [label, controller] of [
  ['an integer', '42'],
  ['a numeric string', '"42"'],
]) {
  test(`method with ${label} as controller is kept`, () => {
    const value = `{"type":"Ed25519VerificationKey2020","controller":${controller}}`;
    const doc = toDidDocumentShape(DID, OWNER, [DID], [
      attribute('verificationMethod', [item(value)]),
      attribute('authentication', [item(value)]),
    ]);
    assert.equal(doc.verificationMethod.length, 1);
    assert.deepEqual(doc.authentication, [{ id: `${DID}#auth_0`, uri: null }]);
  });
}

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

test('end to end: services decode to the same documents as the subgraph path', async () => {
  // Same two values tests/resolver.test.js drives through the subgraph mock, so a
  // divergence in either backend shows up as one of the two suites failing.
  const string = { type: 'LinkedDomains', serviceEndpoint: 'https://xny.ai' };
  const map = {
    type: 'DIDCommMessaging',
    serviceEndpoint: { uri: 'https://xny.ai/didcomm', accept: ['didcomm/v2'] },
  };
  const backend = backendReturning(OWNER, [], [
    attribute('service', [
      item(JSON.stringify(string)),
      item(JSON.stringify(map)),
    ]),
  ]);
  const doc = await new Resolver(backend).resolve(DID);

  assert.deepEqual(doc.service, [
    {
      id: `${DID}#service_0`,
      type: 'LinkedDomains',
      serviceEndpoint: 'https://xny.ai',
    },
    {
      id: `${DID}#service_1`,
      type: 'DIDCommMessaging',
      serviceEndpoint: { uri: 'https://xny.ai/didcomm', accept: ['didcomm/v2'] },
    },
  ]);
});

test('a service blob with invalid UTF-8 does not 500 the whole document', async () => {
  // The backend decodes leniently to match graph-ts, so it keeps this entry. If the
  // assembly decoded strictly it would throw on the same bytes, and the catch in
  // resolve() would turn one operator's malformed entry into a 500 for every DID
  // that has one.
  const good = Buffer.from(
    JSON.stringify({ type: 'LinkedDomains', serviceEndpoint: 'https://xny.ai/' }),
    'utf8'
  );
  const withBadByte = Buffer.concat([
    good.subarray(0, good.length - 2),
    Buffer.from([0xff]),
    good.subarray(good.length - 2),
  ]);

  const backend = backendReturning(OWNER, [], [
    {
      name: 'service',
      values: [{ value: '0x' + withBadByte.toString('hex'), revoked: false }],
    },
  ]);
  const doc = await new Resolver(backend).resolve(DID);

  assert.equal(doc.service.length, 1);
  // U+FFFD where the bad byte was. Whether the indexer would have stored this entry
  // at all is a separate, unsettled question — see IN-3167.
  assert.equal(doc.service[0].serviceEndpoint, 'https://xny.ai/�');
});

// A blob's controller only reaches assembly when it is an integer or an all-digits
// string — isStorableMethod drops a DID-string one, matching addSingleMethod. So the
// undefined case and the numeric ones are the reachable set, and the numeric ones are
// what used to be emitted verbatim as `controller: 42`, which is not a DID at all.
for (const [label, controller] of [
  ['no controller', undefined],
  ['an integer controller', 42],
  ['a numeric-string controller', '42'],
]) {
  test(`a blob with ${label} cannot displace the id or controller`, async () => {
    const blob = {
      type: 'Ed25519VerificationKey2020',
      id: `${OTHER_DID}#hijacked`,
      publicKeyMultibase: 'z6MkAttackerKey',
    };
    if (controller !== undefined) {
      blob.controller = controller;
    }
    const backend = backendReturning(OWNER, [], [
      attribute('verificationMethod', [item(JSON.stringify(blob))]),
    ]);
    const doc = await new Resolver(backend).resolve(DID);

    assert.deepEqual(doc.verificationMethod, [
      {
        id: `${DID}#vm_0`,
        type: 'Ed25519VerificationKey2020',
        controller: DID,
        // Key material the operator supplied still comes through — that is what the
        // spread is for.
        publicKeyMultibase: 'z6MkAttackerKey',
      },
    ]);
  });
}

test('a blob cannot smuggle __proto__ into the served document', async () => {
  // Inert inside this process, but serializing it hands every downstream consumer a
  // prototype-pollution gadget: an Object.assign into a record replaces that record's
  // prototype, and a hand-rolled recursive merge reaches Object.prototype itself.
  const blob =
    '{"type":"Ed25519VerificationKey2020","__proto__":{"verified":true},"constructor":{"x":1},"publicKeyMultibase":"z1"}';
  const backend = backendReturning(OWNER, [], [
    attribute('verificationMethod', [item(blob)]),
  ]);
  const doc = await new Resolver(backend).resolve(DID);

  const served = JSON.stringify(doc.verificationMethod[0]);
  assert.ok(!served.includes('__proto__'), served);
  assert.ok(!served.includes('constructor'), served);
  // The legitimate field is untouched.
  assert.equal(doc.verificationMethod[0].publicKeyMultibase, 'z1');
  // And a downstream merge of the served document stays clean.
  const merged = Object.assign({}, JSON.parse(served));
  assert.equal(Object.getPrototypeOf(merged), Object.prototype);
  assert.equal(merged.verified, undefined);
});

test('the rpc backend drops a blob that is not a JSON object before assembly ever sees it', async () => {
  // The assembly is guarded too — tests/resolver.test.js drives these through the
  // subgraph path, which forwards unchecked — but this is the layer that keeps them
  // from arriving in the first place.
  for (const value of ['null', '"hi"', '[1,2]', '42']) {
    const backend = backendReturning(OWNER, [], [
      attribute('verificationMethod', [item(value)]),
    ]);
    const doc = await new Resolver(backend).resolve(DID);
    assert.deepEqual(doc.verificationMethod, [], value);
  }
});

test('a verification method with an invalid UTF-8 byte keeps its key material', async () => {
  // The backend decodes leniently to match graph-ts and keeps this entry. A strict
  // decode during assembly threw on the same bytes, the catch swallowed it, and the
  // method was emitted with no key material — a verification method that cannot
  // verify anything, silently.
  const good = Buffer.from(
    JSON.stringify({
      type: 'Ed25519VerificationKey2020',
      publicKeyMultibase: 'z6MkRealKey',
    }),
    'utf8'
  );
  const withBadByte = Buffer.concat([
    good.subarray(0, good.length - 2),
    Buffer.from([0xff]),
    good.subarray(good.length - 2),
  ]);

  const backend = backendReturning(OWNER, [], [
    {
      name: 'verificationMethod',
      values: [{ value: '0x' + withBadByte.toString('hex'), revoked: false }],
    },
  ]);
  const doc = await new Resolver(backend).resolve(DID);

  assert.equal(doc.verificationMethod.length, 1);
  // U+FFFD where the bad byte was. Whether the indexer would have stored this entry
  // at all is a separate, unsettled question — see IN-3167; what this pins is only
  // that the backend and the assembly reach the same verdict about the same bytes.
  assert.equal(doc.verificationMethod[0].publicKeyMultibase, 'z6MkRealKey�');
});

test('every relationship reference dereferences to a verification method in the document', async () => {
  // The harm the id displacement caused, stated as the property that has to hold:
  // authentication names a method by id, and a verifier has to be able to find it.
  const backend = backendReturning(OWNER, [], [
    attribute('verificationMethod', [
      item(
        JSON.stringify({
          type: 'Ed25519VerificationKey2020',
          id: `${OTHER_DID}#hijacked`,
          publicKeyMultibase: 'z6Mk',
        })
      ),
    ]),
    attribute('authentication', [item('0')]),
    attribute('assertionMethod', [item('0')]),
  ]);
  const doc = await new Resolver(backend).resolve(DID);

  // Anchor the quantifier: without these the property holds vacuously over an empty
  // relation array, so a regression that stopped emitting relations would pass.
  assert.equal(doc.verificationMethod.length, 1);

  const known = new Set(doc.verificationMethod.map((vm) => vm.id));
  for (const relation of ['authentication', 'assertionMethod']) {
    assert.equal(doc[relation].length, 1);
    for (const reference of doc[relation]) {
      assert.ok(
        known.has(reference),
        `${relation} names ${reference}, which is not in verificationMethod`
      );
    }
  }
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
