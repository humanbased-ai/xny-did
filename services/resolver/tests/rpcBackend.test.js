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

// The backend shape above and the served document below deliberately differ. The
// backend keeps [] because that is the shape the subgraph also returns, and the two
// have to be indistinguishable. The document omits, because that is the only rule
// that can cover all of the list-valued properties at once: DID Core requires a
// verification relationship to be "a set of one or more", so those five cannot be
// [] at all, while "if present" in front of every definition makes omitting legal
// everywhere.
test('a DID with nothing on it omits every empty list rather than emitting []', async () => {
  const doc = await new Resolver(backendReturning(OWNER, [], [])).resolve(DID);

  // The exact key set, not a per-property check, so that a list-valued property
  // added later cannot quietly start emitting [] without failing here.
  assert.deepEqual(Object.keys(doc), ['@context', 'id', 'controller', 'owner']);
});

test('alsoKnownAs that existed and was fully revoked is omitted too', async () => {
  // The one case where the document loses a distinction the backend keeps: never
  // had an alias (null) and had one that was revoked ([]) both read as absent. A
  // consumer cannot act on the difference — an empty set of aliases is no aliases —
  // and keeping it would have meant two rules again.
  const backend = backendReturning(OWNER, [], [
    attribute('alsoKnownAs', [item('https://example.com/a', true)]),
  ]);
  const doc = await new Resolver(backend).resolve(DID);

  assert.ok(!('alsoKnownAs' in doc));
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

  assert.deepEqual(doc['@context'], [
    'https://www.w3.org/ns/did/v1',
    'https://w3id.org/xny/v1',
  ]);
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

test('a service blob with invalid UTF-8 is dropped, as the indexer drops it', async () => {
  // The indexer parses service blobs with json.try_fromBytes, which rejects malformed
  // UTF-8 outright rather than substituting — measured against graph-node in
  // services/indexer/tests/utf8.test.ts. It creates no Service entity, so the subgraph
  // backend has nothing to return. The rpc backend has to reach the same verdict or
  // the two backends disagree about the same DID.
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

  assert.ok(!('service' in doc));
  // And the document as a whole still resolves: one operator's malformed entry must
  // cost that entry, not a 500 for every DID that has one.
  assert.equal(doc.id, DID);
});

test('one malformed service entry does not take a valid sibling with it', async () => {
  // Guards the drop against being implemented as "abandon the service array".
  const bad = Buffer.from(
    JSON.stringify({ type: 'LinkedDomains', serviceEndpoint: 'https://xny.ai/x' }),
    'utf8'
  );
  const withBadByte = Buffer.concat([
    bad.subarray(0, bad.length - 2),
    Buffer.from([0xff]),
    bad.subarray(bad.length - 2),
  ]);

  const backend = backendReturning(OWNER, [], [
    {
      name: 'service',
      values: [
        { value: '0x' + withBadByte.toString('hex'), revoked: false },
        {
          value:
            '0x' +
            Buffer.from(
              JSON.stringify({
                type: 'LinkedDomains',
                serviceEndpoint: 'https://xny.ai/ok',
              }),
              'utf8'
            ).toString('hex'),
          revoked: false,
        },
      ],
    },
  ]);
  const doc = await new Resolver(backend).resolve(DID);

  assert.deepEqual(doc.service, [
    {
      // index 1, not 0: the dropped entry still consumed its on-chain index, exactly
      // as a revoked one does, so the surviving entry keeps the id it has on-chain.
      id: `${DID}#service_1`,
      type: 'LinkedDomains',
      serviceEndpoint: 'https://xny.ai/ok',
    },
  ]);
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
    assert.ok(!('verificationMethod' in doc), value);
  }
});

test('a verification method with an invalid UTF-8 byte is dropped, not served keyless', async () => {
  // Two wrong answers were possible here and both were reachable at some point: serve
  // the method with U+FFFD substituted into its key material, or serve it with the key
  // material missing entirely — a verification method that cannot verify anything.
  // The right answer is neither. The indexer's json.try_fromBytes rejects these bytes
  // and no VerificationMethod entity is created, so the entry must not exist.
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

  assert.ok(!('verificationMethod' in doc));
  assert.equal(doc.id, DID);
});

test('an overlong encoding is not decoded into the codepoint it spells', async () => {
  // 0xc0 0xaf is an illegal second spelling of '/'. ethers' lenient decoder emits a
  // real '/' for it, which would make an alsoKnownAs value indistinguishable from one
  // an operator actually wrote — and would disagree with the subgraph, where
  // Bytes.toString() yields two replacement characters instead
  // (services/indexer/tests/utf8.test.ts).
  const backend = backendReturning(OWNER, [], [
    {
      name: 'alsoKnownAs',
      values: [
        { value: '0x' + Buffer.from([0x61, 0xc0, 0xaf, 0x62]).toString('hex'), revoked: false },
      ],
    },
  ]);
  const doc = await new Resolver(backend).resolve(DID);

  assert.deepEqual(doc.alsoKnownAs, ['a��b']);
  assert.notEqual(doc.alsoKnownAs[0], 'a/b');
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

test('an inline verification method in a relationship is dropped, not rendered as null', async () => {
  // The middle entry's on-chain value is a JSON object, which the indexer stores as an
  // embedded method with no uri. Mapping it straight through emitted [null].
  const backend = backendReturning(OWNER, [], [
    attribute('authentication', [
      item('0'),
      item('{"type":"Ed25519VerificationKey2020"}'),
      item(OTHER_DID),
    ]),
  ]);
  const doc = await new Resolver(backend).resolve(DID);

  // Surviving references keep their order, and nothing is null.
  assert.deepEqual(doc.authentication, [`${DID}#vm_0`, OTHER_DID]);
});

test('a relationship whose every entry is inline is omitted, not emitted empty', async () => {
  const inline = '{"type":"Ed25519VerificationKey2020"}';

  // Anchor first: the backend really does hand assembly one entry with a null uri.
  // Without this the assertion below would keep passing if a future tightening of
  // isStorableMethod stopped the entry being created at all — testing nothing.
  const shape = toDidDocumentShape(DID, OWNER, [DID], [
    attribute('authentication', [item(inline)]),
  ]);
  assert.deepEqual(shape.authentication, [{ id: `${DID}#auth_0`, uri: null }]);

  const backend = backendReturning(OWNER, [], [
    attribute('authentication', [item(inline)]),
    attribute('assertionMethod', [item('0')]),
  ]);
  const doc = await new Resolver(backend).resolve(DID);

  assert.ok(!('authentication' in doc), JSON.stringify(doc.authentication));
  // The relationship that does have a usable entry is untouched.
  assert.deepEqual(doc.assertionMethod, [`${DID}#vm_0`]);
});

test('dropped entries are reported once per relation, naming them', async () => {
  // The point of logging at all is that an operator who wrote an inline entry can
  // find out why it is missing, so the entity id has to be in the message. One line
  // per relation rather than per entry, because the count is the operator's to choose.
  const inline = '{"type":"Ed25519VerificationKey2020"}';
  const backend = backendReturning(OWNER, [], [
    attribute('authentication', Array.from({ length: 20 }, () => item(inline))),
    attribute('keyAgreement', [item(inline)]),
  ]);

  const lines = [];
  const original = console.warn;
  console.warn = (line) => lines.push(line);
  try {
    await new Resolver(backend).resolve(DID);
  } finally {
    console.warn = original;
  }

  assert.equal(lines.length, 2, lines.join('\n'));
  const authentication = lines.find((l) => l.includes('authentication'));
  assert.match(authentication, /Dropping 20 authentication entries/);
  assert.ok(authentication.includes(`${DID}#auth_0`), authentication);
  // Truncated rather than listing all twenty.
  assert.ok(authentication.includes('…'), authentication);

  const keyAgreement = lines.find((l) => l.includes('keyAgreement'));
  assert.match(keyAgreement, /Dropping 1 keyAgreement entry/);
  assert.ok(keyAgreement.includes(`${DID}#ka_0`), keyAgreement);
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
