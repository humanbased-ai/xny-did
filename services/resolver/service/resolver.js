const ethers = require('ethers');
const config = require('config');

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
        throw new Error(result.errors.map((e) => e.message).join(', '));
      }

      const didDoc = result.data.diddocument;
      if (!didDoc) {
        throw new Error(`DID Document not found for identifier: ${identifier}`);
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
      throw error;
    }
  }
}

const ResolverInstance = new Resolver(
  config.get('GRAPH_URL'),
  config.get('GRAPH_ACCESS_TOKEN')
);

module.exports = ResolverInstance;
