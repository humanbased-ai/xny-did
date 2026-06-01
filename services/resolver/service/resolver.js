const ethers = require('ethers');
const config = require('config');

// did:codatta:<uuid> — the uuid is a uint128 rendered as 8-4-4-4-12 hex.
// It is NOT a strict v4 UUID (the on-chain uint128 carries no version/variant bits),
// so we validate the layout only, not the v4 semantic nibbles.
// The "did:codatta:" prefix is matched case-sensitively (per DID Core the scheme and
// method name are lowercase); only the hex section accepts upper/lower case.
const DID_CODATTA_RE =
  /^did:codatta:[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

// Carries the HTTP status + DID Resolution error code so the controller can map it.
class ResolveError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ResolveError';
    this.status = status;
    this.code = code;
  }
}

class Resolver {
  /**
   * Constructor
   * @param {string} graphUrl - The Graph API URL
   * @param {string} accessToken - The Authorization token
   */
  constructor(graphUrl, accessToken) {
    this.graphUrl = graphUrl;
    this.accessToken = accessToken;
  }

  /**
   * Query the DID Document from The Graph
   * @param {string} identifier - The DID to query
   * @returns {Promise<object>} - The resolved DID Document object
   */
  async resolve(identifier) {
    if (!DID_CODATTA_RE.test(identifier)) {
      throw new ResolveError(
        `Invalid did:codatta identifier: ${identifier}`,
        400,
        'invalidDid'
      );
    }
    try {
      const query = `query($didId: ID!) { diddocument(id: $didId) { id owner controllers: controller verificationMethod { id method { id type value } } alsoKnownAs authentication { id uri } assertionMethod { id uri } keyAgreement { id uri } capabilityInvocation { id uri } capabilityDelegation { id uri } service { id type serviceEndpoint } } }`;

      const req = new ethers.FetchRequest(this.graphUrl);
      req.method = 'POST';
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Authorization', this.accessToken);
      req.body = {
        query: query,
        variables: { didId: identifier },
      };

      const response = await req.send();
      const result = response.bodyJson;

      if (result.errors) {
        throw new ResolveError(
          result.errors.map((e) => e.message).join(', '),
          500,
          'internalError'
        );
      }

      const didDoc = result.data.diddocument;
      if (!didDoc) {
        throw new ResolveError(
          `DID Document not found for identifier: ${identifier}`,
          404,
          'notFound'
        );
      }

      const document = {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: didDoc.id,
        controller: didDoc.controllers,
        owner: didDoc.owner,
      };

      if (didDoc.alsoKnownAs) {
        document.alsoKnownAs = didDoc.alsoKnownAs;
      }

      if (didDoc.verificationMethod) {
        document.verificationMethod = didDoc.verificationMethod.map((vm) => {
          let methodDetails = {};
          try {
            if (vm.method.value && vm.method.value.startsWith('0x')) {
              methodDetails = JSON.parse(ethers.toUtf8String(vm.method.value));
            }
          } catch (e) {
            console.warn('Error decoding verification method value', e);
          }
          return {
            id: vm.id,
            type: vm.method.type,
            controller: didDoc.id,
            ...methodDetails,
          };
        });
      }

      const relations = [
        'authentication',
        'assertionMethod',
        'keyAgreement',
        'capabilityInvocation',
        'capabilityDelegation',
      ];

      for (const relation of relations) {
        if (didDoc[relation] && didDoc[relation].length > 0) {
          document[relation] = didDoc[relation].map((item) => item.uri);
        }
      }

      if (didDoc.service) {
        document.service = didDoc.service;
      }

      return document;
    } catch (error) {
      console.error(`\n❌ Query DID ${identifier} failed:`, error.message);
      if (error instanceof ResolveError) {
        throw error;
      }
      // Network / GraphQL transport failures map to internalError (500).
      throw new ResolveError(error.message, 500, 'internalError');
    }
  }
}

const ResolverInstance = new Resolver(
  config.get('GRAPH_URL'),
  config.get('GRAPH_ACCESS_TOKEN')
);

module.exports = ResolverInstance;
module.exports.Resolver = Resolver;
module.exports.ResolveError = ResolveError;
