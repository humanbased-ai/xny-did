'use strict';

const ethers = require('ethers');
const { DEFAULT_TIMEOUT_MS } = require('./subgraph');
// graph-ts' Bytes.toString() decodes UTF-8 leniently, so this substitutes rather than
// rejecting. Shared with the document assembly, which decodes service values a second
// time and has to reach the same verdict — see service/bytes.js.
const { bytesToString } = require('../bytes');

// Base mainnet is the authoritative deployment for did:xny (see docs/xny-did-method.md),
// and both of these are public: the endpoint takes no API key and the address is the
// registry proxy from contracts/script/config/deployment.base.json. Defaults live here
// rather than in config/default.json because that file is gitignored and never ships in
// the image — the Universal Resolver runs this container with no environment at all.
const DEFAULT_RPC_URL = 'https://mainnet.base.org';
const DEFAULT_REGISTRY_ADDRESS = '0xf73eD23b998b3987503F4F4Ba4eAb85386ebfCC4';
const DEFAULT_CHAIN_ID = 8453;

const REGISTRY_ABI = [
  'function getDidDocument(uint128 identifier) view returns (uint128 id, address owner, uint128[] controller, tuple(string name, bytes value)[] kvAttributes, tuple(string name, tuple(bytes value, bool revoked)[] values)[] arrayAttributes)',
];

// The subgraph derives one entity per array-attribute item and names it by the item's
// index (services/indexer/src/arrayAttributeHandler.ts). Revoking only flips a flag and
// keeps the slot (DIDRegistry.sol:405-423), so walking the array by index here yields the
// same ids the subgraph produced.
const RELATIONS = [
  { name: 'authentication', prefix: 'auth' },
  { name: 'assertionMethod', prefix: 'am' },
  { name: 'keyAgreement', prefix: 'ka' },
  { name: 'capabilityInvocation', prefix: 'ci' },
  { name: 'capabilityDelegation', prefix: 'cd' },
];

/** did:xny:<uuid> -> the uint128 the registry is keyed by. */
function didToUint128(identifier) {
  return BigInt('0x' + identifier.slice('did:xny:'.length).replace(/-/g, ''));
}

/** The inverse of the indexer's uint128ToDID (services/indexer/src/utils.ts:38). */
function uint128ToDID(value) {
  const hex = value.toString(16).padStart(32, '0');
  return `did:xny:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function parseJsonObject(hexValue) {
  let parsed;
  try {
    parsed = JSON.parse(bytesToString(hexValue));
  } catch (e) {
    return null;
  }
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed
    : null;
}

// addSingleMethod (arrayAttributeHandler.ts:82-118) refuses to create an entity unless
// type is a string AND, when controller is present, it is either an integral number or a
// string. An explicit null, a float, a bool or an array all abort it, so the subgraph has
// no entity for that item at all and neither may we. Shared by verificationMethod and the
// five relations, which both route through addSingleMethod upstream.
function isStorableMethod(parsed) {
  if (!parsed || typeof parsed.type !== 'string') {
    return false;
  }
  if (!('controller' in parsed)) {
    return true;
  }
  const controller = parsed.controller;
  return (
    (typeof controller === 'number' && Number.isInteger(controller)) ||
    // A non-numeric string reaches BigInt.fromString upstream, which does not return a
    // value the handler can use; treating it as dropped is the closest match.
    (typeof controller === 'string' && /^[0-9]+$/.test(controller))
  );
}

function findAttribute(arrayAttributes, name) {
  const attribute = arrayAttributes.find((a) => a.name === name);
  return attribute ? attribute.values : [];
}

// isNumericString in services/indexer/src/utils.ts:65 — digits only, non-empty.
function isNumericString(s) {
  return /^[0-9]+$/.test(s);
}

// isValidDID in services/indexer/src/utils.ts:42 — deliberately loose: the indexer stores
// whatever passes this, so a stricter check here would drop entries the subgraph kept.
function isValidDID(did) {
  if (!did.startsWith('did:')) {
    return false;
  }
  const parts = did.split(':');
  return parts.length >= 3 && parts.every((p) => p.length > 0);
}

// Rebuilds what the subgraph would hold for this DID. Every field name below matches the
// GraphQL query in subgraph.js, because service/resolver.js assembles the response from
// this shape and must not be able to tell the two backends apart.
function toDidDocumentShape(did, owner, controller, arrayAttributes) {
  const verificationMethod = [];
  findAttribute(arrayAttributes, 'verificationMethod').forEach((item, index) => {
    if (item.revoked) {
      return;
    }
    const parsed = parseJsonObject(item.value);
    if (!isStorableMethod(parsed)) {
      return;
    }
    const id = `${did}#vm_${index}`;
    verificationMethod.push({
      id,
      method: { id, type: parsed.type, value: item.value },
    });
  });

  const document = {
    id: did,
    owner,
    controllers: controller,
    verificationMethod,
    alsoKnownAs: null,
    service: [],
  };

  // alsoKnownAs is a plain string list on the entity, not a child entity, and the indexer
  // refuses duplicates (did-registry.ts:56-73). A DID that never had one leaves the field
  // null, which is not the same as an empty list to the assembly step.
  const alsoKnownAsItems = findAttribute(arrayAttributes, 'alsoKnownAs');
  if (alsoKnownAsItems.length > 0) {
    const seen = new Set();
    document.alsoKnownAs = alsoKnownAsItems
      .filter((item) => !item.revoked)
      .map((item) => bytesToString(item.value))
      .filter((value) => (seen.has(value) ? false : seen.add(value)));
  }

  for (const { name, prefix } of RELATIONS) {
    document[name] = [];
    findAttribute(arrayAttributes, name).forEach((item, index) => {
      if (item.revoked) {
        return;
      }
      const id = `${did}#${prefix}_${index}`;
      const parsed = parseJsonObject(item.value);
      if (parsed) {
        // An object value becomes an embedded SingleMethod, and the entity's uri stays
        // null (arrayAttributeHandler.ts:206). getAuthParams:197-207 propagates the
        // addSingleMethod failure, so a rejected method drops the relation entry too.
        if (!isStorableMethod(parsed)) {
          return;
        }
        document[name].push({ id, uri: null });
        return;
      }
      const value = bytesToString(item.value);
      if (isNumericString(value)) {
        document[name].push({ id, uri: `${did}#vm_${value}` });
      } else if (isValidDID(value)) {
        document[name].push({ id, uri: value });
      }
    });
  }

  findAttribute(arrayAttributes, 'service').forEach((item, index) => {
    if (item.revoked) {
      return;
    }
    const parsed = parseJsonObject(item.value);
    // addService requires a string type and a serviceEndpoint key, and stores the whole
    // raw value as serviceEndpoint (arrayAttributeHandler.ts:310-337).
    if (
      !parsed ||
      typeof parsed.type !== 'string' ||
      parsed.serviceEndpoint === undefined
    ) {
      return;
    }
    document.service.push({
      id: `${did}#service_${index}`,
      type: parsed.type,
      serviceEndpoint: item.value,
    });
  });

  // The registry also returns kvAttributes and an @context array attribute. Neither
  // reaches a DID Document today: _kvAttributeNames is empty and the indexer's KvAttribute
  // set is too (services/indexer/src/constants.ts:24), and the assembly step hardcodes
  // @context. Reading them here would make this backend diverge from the subgraph.
  return document;
}

// Reads the registry contract directly over a public RPC endpoint. This is the backend the
// published image defaults to: the Universal Resolver builds and runs driver containers on
// DIF infrastructure with a public .env, so the container has to work with no secrets.
class RpcBackend {
  /**
   * @param {string} [rpcUrl] - JSON-RPC endpoint; defaults to public Base mainnet
   * @param {string} [registryAddress] - DIDRegistry proxy address
   * @param {number} [timeoutMs] - Upstream request timeout, ms
   * @param {number} [chainId] - Chain the endpoint is expected to serve
   */
  constructor(rpcUrl, registryAddress, timeoutMs, chainId) {
    this.rpcUrl = rpcUrl || DEFAULT_RPC_URL;
    this.registryAddress = registryAddress || DEFAULT_REGISTRY_ADDRESS;
    this.timeoutMs = timeoutMs || DEFAULT_TIMEOUT_MS;
    this.chainId = chainId || DEFAULT_CHAIN_ID;

    const req = new ethers.FetchRequest(this.rpcUrl);
    req.timeout = this.timeoutMs;
    // staticNetwork stops ethers from spending an eth_chainId round-trip before every
    // call, and pins the chain so a misconfigured endpoint fails loudly.
    const provider = new ethers.JsonRpcProvider(req, this.chainId, {
      staticNetwork: true,
    });
    this.registry = new ethers.Contract(
      this.registryAddress,
      REGISTRY_ABI,
      provider
    );
  }

  /**
   * @param {string} identifier - a validated did:xny identifier
   * @returns {Promise<object|null>} the raw DIDDocument shape, or null if unregistered
   */
  async fetch(identifier) {
    const [, owner, controller, , arrayAttributes] =
      await this.registry.getDidDocument(didToUint128(identifier));

    // getDidDocument does not revert for an unknown identifier — it returns a zeroed
    // struct (DIDRegistry.sol:643-687), so the zero owner is the not-found signal.
    if (owner === ethers.ZeroAddress) {
      return null;
    }

    // register() never adds the DID to its own controller set (DIDRegistry.sol:276-285);
    // the subgraph seeds controller = [did] instead (did-registry.ts:264-266), and
    // IDIDRegistry's NatSpec requires resolvers to list the self DID first.
    //
    // Past the first entry the order can differ from the subgraph's, and cannot be made
    // to agree from here: _didControllers is an EnumerableSet, whose remove() swaps the
    // last element into the freed slot, while the subgraph splices and so keeps insertion
    // order. Only a DID that has had a controller revoked is affected, and controller is a
    // set under DID Core, so this is a rendering difference rather than a semantic one.
    const controllers = [
      identifier,
      ...controller.map((c) => uint128ToDID(BigInt(c))),
    ];

    return toDidDocumentShape(
      identifier,
      // Bytes render as lowercase hex in the subgraph; ethers checksums addresses.
      owner.toLowerCase(),
      controllers,
      // Read positionally. ethers' Result extends Array, so `.values` resolves to
      // Array.prototype.values — the iterator, not the struct member — and named access
      // would silently hand back a function here.
      arrayAttributes.map(([name, values]) => ({
        name,
        values: values.map(([value, revoked]) => ({ value, revoked })),
      }))
    );
  }
}

module.exports = {
  RpcBackend,
  DEFAULT_RPC_URL,
  DEFAULT_REGISTRY_ADDRESS,
  DEFAULT_CHAIN_ID,
  didToUint128,
  uint128ToDID,
  toDidDocumentShape,
};
