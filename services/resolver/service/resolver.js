const ethers = require('ethers');
const config = require('config');
const { toBigInt, fromBigInt } = require('../utils/did-parser');

class Resolver {
  /**
   * Constructor
   * @param {string} rpcUrl - The chain node RPC URL
   * @param {string} contractAddress - DIDRegistry contract address
   * @param {object} abi - contract ABI
   */
  constructor(rpcUrl, contractAddress, abi) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contract = new ethers.Contract(contractAddress, abi, this.provider);
  }

  /**
   * Query the DID Document on the chain
   * @param {string | number} identifier - The DID to query
   * @returns {Promise<object>} - The resolved DID Document object
   */
  async resolve(identifier) {
    try {
      var identifierUint128 = toBigInt(identifier);
      var document = {};
      var result = await this.contract.getDidDocument(identifierUint128);
      if (result.owner === ethers.ZeroAddress) {
        throw new Error(`DID Document not found for identifier: ${identifier}`);
      }
      document.id = identifier;
      document.owner = result.owner;
      document.controllers = [];
      for (const controller of result.controller) { 
        document.controllers.push(fromBigInt(controller));
      }
      var attributes = this.parseAttributes(result);
      Object.assign(document, attributes);
      return document;
    } catch (error) {
      console.error(`\n❌ Query DID ${identifier} failed:`, error.message);
      throw error;
    }
  }

  parseAttributes(result) {
    const attributes = {};
    const kvAttributes = result.kvAttributes.map((attr) => {
      return {
        name: attr.name,
        value: ethers.toUtf8String(attr.value),
      };
    });
    
    for (const attr of kvAttributes) {
      attributes[attr.name] = attr.value;
    }
    const arrayAttributes = result.arrayAttributes.map((attr) => {
      return {
        name: attr.name,
        values: attr.attributeValues.map((item) => {
          return {
            value: ethers.toUtf8String(item.value),
            revoked: item.revoked,
          };
        }),
      };
    });

    for (const attr of arrayAttributes) {
      attributes[attr.name] = [];
      for (const item of attr.values) {
        attributes[attr.name].push(JSON.parse(item.value));
      }
    }
    return attributes;
  }
}

const ResolverInstance = new Resolver(
  config.get('RPC_URL'),
  config.get('CONTRACT_ADDRESS'),
  require('../abi/DIDRegistry.json')
);

module.exports = ResolverInstance;
