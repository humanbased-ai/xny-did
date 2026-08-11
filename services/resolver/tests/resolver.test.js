'use strict';

// No environment is set up here on purpose: resolver.js builds a config-backed singleton
// at module load, and requiring it on a clean checkout is the check that the default rpc
// backend needs no configuration. Tests drive their own backend instances.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { Resolver } = require('../service/resolver');
const { SubgraphBackend } = require('../service/backends/subgraph');
const {
  negotiateRepresentation,
  toDidDocumentJson,
  toResolutionResult,
} = require('../service/contentNegotiation');
const controllers = require('../controllers/Default');

const RESOLUTION_PROFILE =
  'application/ld+json;profile="https://w3id.org/did-resolution"';

// Valid-layout did:xny identifiers used to steer the mock subgraph.
const FOUND = 'did:xny:11111111-1111-1111-1111-111111111111';
const NOT_FOUND = 'did:xny:22222222-2222-2222-2222-222222222222';
const GRAPH_ERROR = 'did:xny:33333333-3333-3333-3333-333333333333';
const WITH_SERVICE = 'did:xny:44444444-4444-4444-4444-444444444444';

// What the subgraph actually holds for a service: the bytes of the whole on-chain
// JSON blob, not the endpoint inside it (arrayAttributeHandler.ts:337, typed Bytes!
// by schema.graphql:61). tests/rpcBackend.test.js asserts the rpc backend decodes
// the same two values to the same documents.
const storedService = (value) =>
  require('ethers').hexlify(
    require('ethers').toUtf8Bytes(JSON.stringify(value))
  );
const STRING_ENDPOINT = {
  type: 'LinkedDomains',
  serviceEndpoint: 'https://xny.ai',
};
// DID Core admits a map as well as a string, so the decode must not flatten it.
const MAP_ENDPOINT = {
  type: 'DIDCommMessaging',
  serviceEndpoint: { uri: 'https://xny.ai/didcomm', accept: ['didcomm/v2'] },
};

let server;
let resolver;

// Mock The Graph endpoint: branch the response on the queried didId.
before(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      let didId = '';
      try {
        didId = JSON.parse(raw).variables.didId;
      } catch (_) {
        /* ignore */
      }
      res.setHeader('Content-Type', 'application/json');
      if (didId === FOUND) {
        res.end(
          JSON.stringify({
            data: {
              diddocument: {
                id: didId,
                owner: '0x00000000000000000000000000000000000000ab',
                controllers: [didId],
                verificationMethod: [],
                alsoKnownAs: null,
                authentication: [],
                assertionMethod: [],
                keyAgreement: [],
                capabilityInvocation: [],
                capabilityDelegation: [],
                service: [],
              },
            },
          })
        );
      } else if (didId === WITH_SERVICE) {
        res.end(
          JSON.stringify({
            data: {
              diddocument: {
                id: didId,
                owner: '0x00000000000000000000000000000000000000ab',
                controllers: [didId],
                verificationMethod: [],
                alsoKnownAs: null,
                authentication: [],
                assertionMethod: [],
                keyAgreement: [],
                capabilityInvocation: [],
                capabilityDelegation: [],
                service: [
                  {
                    id: `${didId}#service_0`,
                    type: STRING_ENDPOINT.type,
                    serviceEndpoint: storedService(STRING_ENDPOINT),
                  },
                  {
                    id: `${didId}#service_1`,
                    type: MAP_ENDPOINT.type,
                    serviceEndpoint: storedService(MAP_ENDPOINT),
                  },
                ],
              },
            },
          })
        );
      } else if (didId === GRAPH_ERROR) {
        res.end(JSON.stringify({ errors: [{ message: 'subgraph down' }] }));
      } else {
        res.end(JSON.stringify({ data: { diddocument: null } }));
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  resolver = new Resolver(
    new SubgraphBackend(`http://127.0.0.1:${server.address().port}`, 'token')
  );
});

after(() => server.close());

test('invalid DID layout -> 400 invalidDid (no subgraph call)', async () => {
  await assert.rejects(
    () => resolver.resolve('did:xny:not-a-uuid'),
    (e) => e.status === 400 && e.code === 'invalidDid'
  );
});

test('wrong method -> 400 invalidDid', async () => {
  await assert.rejects(
    () => resolver.resolve('did:example:11111111-1111-1111-1111-111111111111'),
    (e) => e.status === 400 && e.code === 'invalidDid'
  );
});

test('uppercase method name -> 400 invalidDid (DID Core case-sensitivity)', async () => {
  await assert.rejects(
    () => resolver.resolve('did:XNY:11111111-1111-1111-1111-111111111111'),
    (e) => e.status === 400 && e.code === 'invalidDid'
  );
});

test('unknown DID -> 404 notFound', async () => {
  await assert.rejects(
    () => resolver.resolve(NOT_FOUND),
    (e) => e.status === 404 && e.code === 'notFound'
  );
});

test('subgraph error -> 500 internalError', async () => {
  await assert.rejects(
    () => resolver.resolve(GRAPH_ERROR),
    (e) => e.status === 500 && e.code === 'internalError'
  );
});

test('known DID -> resolves W3C DID Document', async () => {
  const doc = await resolver.resolve(FOUND);
  assert.deepEqual(doc['@context'], ['https://www.w3.org/ns/did/v1']);
  assert.equal(doc.id, FOUND);
  assert.deepEqual(doc.controller, [FOUND]);
  assert.equal(doc.owner, '0x00000000000000000000000000000000000000ab');
});

test('subgraph path: a blob cannot displace the derived id, or smuggle __proto__', async () => {
  // The rpc backend validates every blob before assembly; this backend forwards
  // whatever graph-node returns, unchecked (subgraph.js). So "one change covers both
  // backends" only holds if the assembly itself is what enforces this — which is what
  // driving the same hostile blob through a subgraph-shaped response pins down.
  const blob =
    '{"type":"Ed25519VerificationKey2020","id":"did:xny:99999999-9999-9999-9999-999999999999#hijacked","__proto__":{"verified":true},"publicKeyMultibase":"z1"}';
  const stub = {
    fetch: async () => ({
      id: FOUND,
      owner: '0x00000000000000000000000000000000000000ab',
      controllers: [FOUND],
      verificationMethod: [
        {
          id: `${FOUND}#vm_0`,
          method: {
            id: `${FOUND}#vm_0`,
            type: 'Ed25519VerificationKey2020',
            value: require('ethers').hexlify(
              require('ethers').toUtf8Bytes(blob)
            ),
          },
        },
      ],
      authentication: [{ id: `${FOUND}#auth_0`, uri: `${FOUND}#vm_0` }],
    }),
  };
  const doc = await new Resolver(stub).resolve(FOUND);

  assert.deepEqual(doc.verificationMethod, [
    {
      id: `${FOUND}#vm_0`,
      type: 'Ed25519VerificationKey2020',
      controller: FOUND,
      publicKeyMultibase: 'z1',
    },
  ]);
  assert.deepEqual(doc.authentication, [`${FOUND}#vm_0`]);
});

test('subgraph path: a blob that is not a JSON object cannot fail the whole document', async () => {
  // This backend forwards whatever graph-node returns, unchecked, so the assembly is
  // the only thing standing between a malformed blob and the response. Destructuring
  // a null throws, and that happens outside any catch — one bad entry would take
  // every other method and every service down with it as a 500. A string would
  // instead spread its character indices in as fields.
  const ethers = require('ethers');
  for (const value of ['null', '"hi"', '[1,2]', '42']) {
    const stub = {
      fetch: async () => ({
        id: FOUND,
        owner: '0x00000000000000000000000000000000000000ab',
        controllers: [FOUND],
        verificationMethod: [
          {
            id: `${FOUND}#vm_0`,
            method: {
              id: `${FOUND}#vm_0`,
              type: 'Ed25519VerificationKey2020',
              value: ethers.hexlify(ethers.toUtf8Bytes(value)),
            },
          },
        ],
        service: [
          {
            id: `${FOUND}#service_0`,
            type: 'LinkedDomains',
            serviceEndpoint: storedService({
              type: 'LinkedDomains',
              serviceEndpoint: 'https://xny.ai',
            }),
          },
        ],
      }),
    };
    const doc = await new Resolver(stub).resolve(FOUND);

    // The method keeps the fields the resolver derives and gains nothing from the
    // blob — no character-index fields, no crash.
    assert.deepEqual(
      doc.verificationMethod,
      [
        {
          id: `${FOUND}#vm_0`,
          type: 'Ed25519VerificationKey2020',
          controller: FOUND,
        },
      ],
      value
    );
    // And the rest of the document survived.
    assert.equal(doc.service.length, 1, value);
  }
});

test('service: the endpoint is served as written, not as the stored bytes', async () => {
  const doc = await resolver.resolve(WITH_SERVICE);
  assert.deepEqual(doc.service[0], {
    id: `${WITH_SERVICE}#service_0`,
    type: 'LinkedDomains',
    serviceEndpoint: 'https://xny.ai',
  });
  // The bug this covers served the hex of the whole blob, which is a value DID
  // Core does not admit and no client can dial.
  assert.ok(!String(doc.service[0].serviceEndpoint).startsWith('0x'));
});

test('service: a map endpoint keeps its shape', async () => {
  const doc = await resolver.resolve(WITH_SERVICE);
  assert.deepEqual(doc.service[1], {
    id: `${WITH_SERVICE}#service_1`,
    type: 'DIDCommMessaging',
    serviceEndpoint: {
      uri: 'https://xny.ai/didcomm',
      accept: ['didcomm/v2'],
    },
  });
});

test('service: endpoints DID Core does not admit are dropped', async () => {
  // The indexer only checks that the key exists, so all of these reach assembly.
  const cases = [
    ['explicit null', null],
    ['a number', 42],
    ['a boolean', false],
    ['an empty set', []],
    ['a set with a non-endpoint in it', ['https://xny.ai', 7]],
  ];
  for (const [label, endpoint] of cases) {
    const stub = {
      fetch: async () => ({
        id: FOUND,
        owner: '0x00000000000000000000000000000000000000ab',
        controllers: [FOUND],
        service: [
          {
            id: `${FOUND}#service_0`,
            type: 'LinkedDomains',
            serviceEndpoint: storedService({
              type: 'LinkedDomains',
              serviceEndpoint: endpoint,
            }),
          },
        ],
      }),
    };
    const doc = await new Resolver(stub).resolve(FOUND);
    assert.deepEqual(doc.service, [], `${label} should have been dropped`);
  }
});

test('service: a set of endpoints is kept', async () => {
  const endpoint = ['https://xny.ai', { uri: 'https://xny.ai/didcomm' }];
  const stub = {
    fetch: async () => ({
      id: FOUND,
      owner: '0x00000000000000000000000000000000000000ab',
      controllers: [FOUND],
      service: [
        {
          id: `${FOUND}#service_0`,
          type: 'LinkedDomains',
          serviceEndpoint: storedService({
            type: 'LinkedDomains',
            serviceEndpoint: endpoint,
          }),
        },
      ],
    }),
  };
  const doc = await new Resolver(stub).resolve(FOUND);
  assert.deepEqual(doc.service[0].serviceEndpoint, endpoint);
});

test('service: only the endpoint is taken from the blob, id and type come from the entity', async () => {
  // Reading serviceEndpoint by name rather than spreading the parsed object is
  // what keeps this true; a spread would let the blob's own id and type win, and
  // the id it carries points into a different DID.
  const blob = {
    type: 'Impersonated',
    id: 'did:xny:99999999-9999-9999-9999-999999999999#whatever',
    serviceEndpoint: 'https://xny.ai',
  };
  const stub = {
    fetch: async () => ({
      id: FOUND,
      owner: '0x00000000000000000000000000000000000000ab',
      controllers: [FOUND],
      service: [
        {
          id: `${FOUND}#service_0`,
          type: 'LinkedDomains',
          serviceEndpoint: storedService(blob),
        },
      ],
    }),
  };
  const doc = await new Resolver(stub).resolve(FOUND);
  assert.deepEqual(doc.service[0], {
    id: `${FOUND}#service_0`,
    type: 'LinkedDomains',
    serviceEndpoint: 'https://xny.ai',
  });
});

// --- Content negotiation (W3C DID Resolution HTTPS binding) ---

test('negotiate: absent / empty Accept -> default did+ld+json', () => {
  for (const accept of [undefined, '', null, '   ']) {
    const r = negotiateRepresentation(accept);
    assert.equal(r.representation, 'didDocumentLd');
    assert.equal(r.contentType, 'application/did+ld+json');
  }
});

test('negotiate: */* -> default did+ld+json', () => {
  const r = negotiateRepresentation('*/*');
  assert.equal(r.representation, 'didDocumentLd');
  assert.equal(r.contentType, 'application/did+ld+json');
});

test('negotiate: unacceptable (text/html) -> fall back to default', () => {
  const r = negotiateRepresentation('text/html');
  assert.equal(r.representation, 'didDocumentLd');
  assert.equal(r.contentType, 'application/did+ld+json');
});

test('negotiate: application/did+json -> bare doc JSON repr', () => {
  const r = negotiateRepresentation('application/did+json');
  assert.equal(r.representation, 'didDocumentJson');
  assert.equal(r.contentType, 'application/did+json');
});

test('negotiate: did-resolution profile -> full Resolution Result', () => {
  const r = negotiateRepresentation(RESOLUTION_PROFILE);
  assert.equal(r.representation, 'resolutionResult');
  assert.equal(r.contentType, RESOLUTION_PROFILE);
});

test('negotiate: ld+json without profile -> did+ld+json', () => {
  const r = negotiateRepresentation('application/ld+json');
  assert.equal(r.representation, 'didDocumentLd');
  assert.equal(r.contentType, 'application/did+ld+json');
});

test('negotiate: ld+json with a non-resolution profile -> default did+ld+json', () => {
  const r = negotiateRepresentation(
    'application/ld+json;profile="https://example.com/other"'
  );
  assert.equal(r.representation, 'didDocumentLd');
  assert.equal(r.contentType, 'application/did+ld+json');
});

test('negotiate: q-values pick highest (did+json over */*)', () => {
  const r = negotiateRepresentation('*/*;q=0.1, application/did+json;q=0.9');
  assert.equal(r.representation, 'didDocumentJson');
});

test('negotiate: highest-q is unrecognized -> falls through to recognized lower-q', () => {
  const r = negotiateRepresentation(
    'text/html;q=0.9, application/did+json;q=0.5'
  );
  assert.equal(r.representation, 'didDocumentJson');
  assert.equal(r.contentType, 'application/did+json');
});

test('negotiate: q=0 entry is ignored', () => {
  const r = negotiateRepresentation('application/did+json;q=0, text/html');
  assert.equal(r.representation, 'didDocumentLd');
});

test('toDidDocumentJson: drops the JSON-LD @context entry', () => {
  const doc = { '@context': ['https://www.w3.org/ns/did/v1'], id: FOUND };
  const json = toDidDocumentJson(doc);
  assert.equal(json['@context'], undefined);
  assert.equal(json.id, FOUND);
  // does not mutate the input
  assert.deepEqual(doc['@context'], ['https://www.w3.org/ns/did/v1']);
});

test('toResolutionResult: wraps document in did-resolution envelope', () => {
  const doc = { id: FOUND };
  const result = toResolutionResult(doc);
  assert.equal(result['@context'], 'https://w3id.org/did-resolution/v1');
  assert.deepEqual(result.didDocument, doc);
  assert.equal(
    result.didResolutionMetadata.contentType,
    'application/did+ld+json'
  );
  assert.deepEqual(result.didDocumentMetadata, {});
});

// Minimal fake HTTP response capturing what the controller writes.
function fakeRes() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    end(payload) {
      this.body = payload;
    },
  };
}

test('controller: default Accept -> 200 bare doc did+ld+json', async () => {
  const doc = { '@context': ['https://www.w3.org/ns/did/v1'], id: FOUND };
  global.Resolver = { resolve: async () => doc };
  const res = fakeRes();
  await controllers.resolve({ params: { identifier: FOUND }, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'application/did+ld+json');
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.id, FOUND);
  assert.equal(parsed.didDocument, undefined); // bare doc, not wrapped
});

test('controller: application/did+json -> 200 bare doc without @context', async () => {
  const doc = { '@context': ['https://www.w3.org/ns/did/v1'], id: FOUND };
  global.Resolver = { resolve: async () => doc };
  const res = fakeRes();
  await controllers.resolve(
    { params: { identifier: FOUND }, headers: { accept: 'application/did+json' } },
    res
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'application/did+json');
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.id, FOUND);
  assert.equal(parsed['@context'], undefined);
});

test('controller: resolution profile Accept -> 200 wrapped Resolution Result', async () => {
  const doc = { '@context': ['https://www.w3.org/ns/did/v1'], id: FOUND };
  global.Resolver = { resolve: async () => doc };
  const res = fakeRes();
  await controllers.resolve(
    { params: { identifier: FOUND }, headers: { accept: RESOLUTION_PROFILE } },
    res
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], RESOLUTION_PROFILE);
  const parsed = JSON.parse(res.body);
  assert.equal(parsed['@context'], 'https://w3id.org/did-resolution/v1');
  assert.deepEqual(parsed.didDocument, doc);
});

// --- Upstream timeout ---

test('hung upstream -> rejects within the configured timeout', async () => {
  // Accepts the request and never answers, which is what a stalled subgraph looks
  // like from here. Without FetchRequest.timeout this would hang for ethers'
  // 5-minute default.
  const hung = http.createServer(() => {});
  await new Promise((resolve) => hung.listen(0, '127.0.0.1', resolve));

  const slow = new Resolver(
    new SubgraphBackend(`http://127.0.0.1:${hung.address().port}`, 'token', 150)
  );

  try {
    const startedAt = process.hrtime.bigint();
    await assert.rejects(
      () => slow.resolve(FOUND),
      (e) => e.status === 500 && e.code === 'internalError'
    );
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    // Generous ceiling: the point is that it gave up on its own, not that it hit
    // the deadline to the millisecond.
    assert.ok(
      elapsedMs < 5000,
      `expected the timeout to fire, took ${elapsedMs.toFixed(0)}ms`
    );
  } finally {
    // The abandoned request leaves a socket open, and close() alone waits for
    // every connection to end — which this server never does. Drop them first or
    // the test process hangs at exit instead of failing.
    hung.closeAllConnections();
    hung.close();
  }
});

test('timeout defaults when not supplied', () => {
  assert.equal(new SubgraphBackend('http://unused.local', 'token').timeoutMs, 10000);
});

// --- Probe routes ---

// Boots the real express app on an ephemeral port so the probes are exercised
// through HTTP rather than by calling handlers directly.
async function withApp(fn) {
  const { createApp } = require('../app');
  const { app, state } = createApp();
  const srv = http.createServer(app);
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    await fn({ base, state });
  } finally {
    // node's fetch keeps its sockets alive, so close() would wait on connections
    // that never end on their own and stall process exit.
    srv.closeAllConnections();
    srv.close();
  }
}

test('GET /health -> 200 without touching the subgraph', async () => {
  await withApp(async ({ base }) => {
    // Any upstream call would have to go through this; a hit means /health is
    // reaching for the subgraph, which would let an outage restart-loop the pod.
    let upstreamCalls = 0;
    global.Resolver = {
      resolve: async () => {
        upstreamCalls += 1;
        return {};
      },
    };

    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
    assert.equal(upstreamCalls, 0);
  });
});

test('GET /ready -> 200 while serving', async () => {
  await withApp(async ({ base }) => {
    const res = await fetch(`${base}/ready`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ready' });
  });
});

test('GET /ready -> 503 once shutdown begins', async () => {
  await withApp(async ({ base, state }) => {
    state.shuttingDown = true;
    const res = await fetch(`${base}/ready`);
    // The load balancer pulls the pod from rotation off this status; a 200 here
    // would keep traffic arriving through the drain window.
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { status: 'shutting down' });
  });
});

test('GET /health stays 200 during shutdown (liveness must not restart a draining pod)', async () => {
  await withApp(async ({ base, state }) => {
    state.shuttingDown = true;
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
  });
});

test('controller: error path stays application/json Resolution Result', async () => {
  const err = Object.assign(new Error('nope'), {
    status: 404,
    code: 'notFound',
  });
  global.Resolver = { resolve: async () => { throw err; } };
  const res = fakeRes();
  await controllers.resolve(
    { params: { identifier: NOT_FOUND }, headers: { accept: RESOLUTION_PROFILE } },
    res
  );
  assert.equal(res.statusCode, 404);
  assert.equal(res.headers['Content-Type'], 'application/json');
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.didResolutionMetadata.error, 'notFound');
});
