'use strict';

// resolver.js builds a config-backed singleton at module load (config.get throws if
// GRAPH_URL / GRAPH_ACCESS_TOKEN are unset). Provide dummies before requiring it so the
// suite is self-contained on a clean checkout; tests use their own mock-server instances.
process.env.GRAPH_URL = process.env.GRAPH_URL || 'http://unused.local';
process.env.GRAPH_ACCESS_TOKEN = process.env.GRAPH_ACCESS_TOKEN || 'test';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { Resolver } = require('../service/resolver');

// Valid-layout did:codatta identifiers used to steer the mock subgraph.
const FOUND = 'did:codatta:11111111-1111-1111-1111-111111111111';
const NOT_FOUND = 'did:codatta:22222222-2222-2222-2222-222222222222';
const GRAPH_ERROR = 'did:codatta:33333333-3333-3333-3333-333333333333';

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
    () => resolver.resolve('did:codatta:not-a-uuid'),
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
    () => resolver.resolve('did:CODATTA:11111111-1111-1111-1111-111111111111'),
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
