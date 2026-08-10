'use strict';

const ethers = require('ethers');
const { ResolveError } = require('../resolveError');

// ethers' FetchRequest defaults to a 5-minute timeout, long enough that a stalled
// subgraph would tie up connections until the pod stops serving. Bound it to
// something a probe interval can outlive.
const DEFAULT_TIMEOUT_MS = 10000;

const QUERY =
  'query($didId: ID!) { diddocument(id: $didId) { id owner controllers: controller verificationMethod { id method { id type value } } alsoKnownAs authentication { id uri } assertionMethod { id uri } keyAgreement { id uri } capabilityInvocation { id uri } capabilityDelegation { id uri } service { id type serviceEndpoint } } }';

// Reads the indexed subgraph. Needs GRAPH_ACCESS_TOKEN, so this backend is for the
// self-hosted instances only — see rpc.js for the secret-free one.
class SubgraphBackend {
  /**
   * @param {string} graphUrl - The Graph API URL
   * @param {string} accessToken - The Authorization token
   * @param {number} [timeoutMs] - Upstream request timeout, ms
   */
  constructor(graphUrl, accessToken, timeoutMs) {
    this.graphUrl = graphUrl;
    this.accessToken = accessToken;
    this.timeoutMs = timeoutMs || DEFAULT_TIMEOUT_MS;
  }

  /**
   * @param {string} identifier - a validated did:xny identifier
   * @returns {Promise<object|null>} the raw DIDDocument shape, or null if unknown
   */
  async fetch(identifier) {
    const req = new ethers.FetchRequest(this.graphUrl);
    req.method = 'POST';
    req.timeout = this.timeoutMs;
    req.setHeader('Content-Type', 'application/json');
    req.setHeader('Authorization', this.accessToken);
    req.body = { query: QUERY, variables: { didId: identifier } };

    const response = await req.send();
    const result = response.bodyJson;

    if (result.errors) {
      throw new ResolveError(
        result.errors.map((e) => e.message).join(', '),
        500,
        'internalError'
      );
    }

    return result.data.diddocument || null;
  }
}

module.exports = { SubgraphBackend, DEFAULT_TIMEOUT_MS };
