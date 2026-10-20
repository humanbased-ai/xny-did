'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const ethers = require('ethers');

const OWNER = '0x00000000000000000000000000000000000000ab';
const REGISTRY = '0x0000000000000000000000000000000000000049';
const abi = new ethers.Interface([
  'function getDidDocument(uint128 identifier) view returns (uint128 id, address owner, uint128[] controller, tuple(string name, bytes value)[] kvAttributes, tuple(string name, tuple(bytes value, bool revoked)[] values)[] arrayAttributes)',
]);
let graph;
let rpc;
let resolver;
let graphCalls;
let rpcCalls;
let graphReply;
let rpcFails;
let rpcOwner;
let did;
let sequence = 0;

const graphDocument = (identifier) => ({
  id: identifier,
  owner: OWNER,
  controllers: [identifier],
  verificationMethod: [],
});

before(async () => {
  graph = http.createServer((req, res) => {
    graphCalls += 1;
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => graphReply(res, JSON.parse(body).variables.didId));
  });
  rpc = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const call = JSON.parse(body);
      rpcCalls.push(call);
      res.setHeader('Content-Type', 'application/json');
      const identifier = abi.decodeFunctionData('getDidDocument', call.params[0].data)[0];
      res.end(JSON.stringify({
        jsonrpc: '2.0', id: call.id,
        ...(rpcFails
          ? { error: { code: -32000, message: 'synthetic RPC failure' } }
          : { result: abi.encodeFunctionResult('getDidDocument', [identifier, rpcOwner, [], [], []]) }),
      }));
    });
  });
  await Promise.all([graph, rpc].map((server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))));
  process.env.NODE_CONFIG = JSON.stringify({
    RESOLVER_BACKEND: 'subgraph',
    RESOLVER_GRAPH_URL: `http://127.0.0.1:${graph.address().port}`,
    RESOLVER_GRAPH_ACCESS_TOKEN: 'synthetic-test-token',
    RESOLVER_RPC_URL: `http://127.0.0.1:${rpc.address().port}`,
    RESOLVER_REGISTRY_ADDRESS: REGISTRY,
    RESOLVER_CHAIN_ID: 84532,
    RESOLVER_TIMEOUT_MS: 100,
  });
  resolver = require('../service/resolver');
});

beforeEach(() => {
  // Distinct calls avoid the real ethers provider's short identical-request cache.
  did = `did:xny:11111111-1111-1111-1111-${(++sequence).toString(16).padStart(12, '0')}`;
  graphCalls = 0;
  rpcCalls = [];
  rpcFails = false;
  rpcOwner = OWNER;
  graphReply = (res) => res.end(JSON.stringify({ message: 'synthetic non-GraphQL object' }));
});
after(async () => {
  await Promise.all([graph, rpc].map((server) => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  })));
});

async function resolvesThroughRPC() {
  const document = await resolver.resolve(did);
  assert.equal(document.id, did);
  assert.equal(document.owner, OWNER);
  assert.equal(graphCalls, 1);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].method, 'eth_call');
  assert.equal(rpcCalls[0].params[0].to, REGISTRY);
  assert.equal(abi.decodeFunctionData('getDidDocument', rpcCalls[0].params[0].data)[0], BigInt('0x' + did.slice(8).replaceAll('-', '')));
}

test('HTTP200 non-GraphQL response resolves the same DID through configured RPC', resolvesThroughRPC);

test('Graph document, including empty errors array, needs no RPC', async () => {
  graphReply = (res, identifier) => res.end(JSON.stringify({ errors: [], data: { diddocument: graphDocument(identifier) } }));
  assert.equal((await resolver.resolve(did)).owner, OWNER);
  assert.equal(graphCalls, 1);
  assert.equal(rpcCalls.length, 0);
});

test('Graph null confirms chain existence, while both null is notFound', async () => {
  graphReply = (res) => res.end(JSON.stringify({ data: { diddocument: null } }));
  await resolvesThroughRPC();
  rpcOwner = ethers.ZeroAddress;
  await assert.rejects(() => resolver.resolve(did.replace('11111111-', '22222222-')), (error) => error.status === 404 && error.code === 'notFound');
  assert.equal(rpcCalls.length, 2);
});

for (const [name, reply] of [
  ['GraphQL error with partial data', (res, identifier) => res.end(JSON.stringify({ errors: [{ message: 'synthetic Graph failure' }], data: { diddocument: graphDocument(identifier) } }))],
  ['non-success HTTP with a valid-looking document', (res, identifier) => { res.statusCode = 503; res.end(JSON.stringify({ data: { diddocument: graphDocument(identifier) } })); }],
  ['rate-limited HTTP without retry', (res, identifier) => {
    if (graphCalls === 1) {
      res.statusCode = 429; res.setHeader('Retry-After', '0'); res.end('{}');
    } else {
      res.end(JSON.stringify({ data: { diddocument: graphDocument(identifier) } }));
    }
  }],
  ['invalid JSON', (res) => res.end('{')],
  ['non-object document', (res) => res.end(JSON.stringify({ data: { diddocument: 'invalid' } }))],
  ['empty document', (res) => res.end(JSON.stringify({ data: { diddocument: {} } }))],
  ['different DID document', (res, identifier) => res.end(JSON.stringify({ data: { diddocument: graphDocument(identifier.replace('11111111-', '22222222-')) } }))],
  ['connection closed before response', (res) => res.destroy()],
]) {
  test(`${name} tries RPC once`, async () => {
    graphReply = reply;
    await resolvesThroughRPC();
  });
}

test('a hung Graph request times out before RPC succeeds', async () => {
  graphReply = () => {};
  const started = process.hrtime.bigint();
  await resolvesThroughRPC();
  assert.ok(Number(process.hrtime.bigint() - started) / 1e6 < 2000);
});

test('RPC failure propagates instead of returning notFound', async () => {
  rpcFails = true;
  await assert.rejects(() => resolver.resolve(did), (error) => error.status === 500 && error.code === 'internalError');
  assert.equal(graphCalls, 1);
  assert.equal(rpcCalls.length, 1);
});

test('the next request uses recovered Graph after RPC fallback', async () => {
  await resolvesThroughRPC();
  graphReply = (res, identifier) => res.end(JSON.stringify({ data: { diddocument: graphDocument(identifier) } }));
  assert.equal((await resolver.resolve(did)).owner, OWNER);
  assert.equal(graphCalls, 2);
  assert.equal(rpcCalls.length, 1);
});

test('invalid DID never fetches either upstream', async () => {
  await assert.rejects(() => resolver.resolve('did:xny:invalid'), (error) => error.status === 400 && error.code === 'invalidDid');
  assert.equal(graphCalls, 0);
  assert.equal(rpcCalls.length, 0);
});

test('document assembly failures do not trigger RPC fallback', async () => {
  const document = graphDocument(did);
  document.verificationMethod = [{ method: null }];
  graphReply = (res) => res.end(JSON.stringify({ data: { diddocument: document } }));
  await assert.rejects(() => resolver.resolve(did), (error) => error.status === 500 && error.code === 'internalError');
  assert.equal(graphCalls, 1);
  assert.equal(rpcCalls.length, 0);
});
