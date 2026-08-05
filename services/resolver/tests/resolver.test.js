'use strict';

// resolver.js builds a config-backed singleton at module load (config.get throws if
// RESOLVER_GRAPH_URL / RESOLVER_GRAPH_ACCESS_TOKEN are unset). Provide dummies before
// requiring it so the suite is self-contained on a clean checkout; tests use their own
// mock-server instances.
process.env.RESOLVER_GRAPH_URL =
  process.env.RESOLVER_GRAPH_URL || 'http://unused.local';
process.env.RESOLVER_GRAPH_ACCESS_TOKEN =
  process.env.RESOLVER_GRAPH_ACCESS_TOKEN || 'test';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { Resolver } = require('../service/resolver');
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
      } else if (didId === GRAPH_ERROR) {
        res.end(JSON.stringify({ errors: [{ message: 'subgraph down' }] }));
      } else {
        res.end(JSON.stringify({ data: { diddocument: null } }));
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  resolver = new Resolver(`http://127.0.0.1:${server.address().port}`, 'token');
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
    `http://127.0.0.1:${hung.address().port}`,
    'token',
    150
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
  const r = new Resolver('http://unused.local', 'token');
  assert.equal(r.timeoutMs, 10000);
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
