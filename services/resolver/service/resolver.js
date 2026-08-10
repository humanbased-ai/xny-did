const ethers = require('ethers');
const config = require('config');
const { ResolveError } = require('./resolveError');
const { bytesToString } = require('./bytes');
const { SubgraphBackend, DEFAULT_TIMEOUT_MS } = require('./backends/subgraph');
const { RpcBackend } = require('./backends/rpc');

// did:xny:<uuid> — the uuid is a uint128 rendered as 8-4-4-4-12 hex.
// It is NOT a strict v4 UUID (the on-chain uint128 carries no version/variant bits),
// so we validate the layout only, not the v4 semantic nibbles.
// The "did:xny:" prefix is matched case-sensitively (per DID Core the scheme and
// method name are lowercase); only the hex section accepts upper/lower case.
const DID_XNY_RE =
  /^did:xny:[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

// DID Core §5.4: a serviceEndpoint is a string URI, a map, or a set composed of one
// or more of those.
function isServiceEndpoint(value) {
  const isMap = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
  if (typeof value === 'string' || isMap(value)) {
    return true;
  }
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === 'string' || isMap(entry))
  );
}

class Resolver {
  /**
   * @param {{fetch: (identifier: string) => Promise<object|null>}} backend
   */
  constructor(backend) {
    this.backend = backend;
  }

  /**
   * Resolve a did:xny identifier to its DID Document.
   * @param {string} identifier - The DID to query
   * @returns {Promise<object>} - The resolved DID Document object
   */
  async resolve(rawIdentifier) {
    if (!DID_XNY_RE.test(rawIdentifier)) {
      throw new ResolveError(
        `Invalid did:xny identifier: ${rawIdentifier}`,
        400,
        'invalidDid'
      );
    }
    // Upper- and lower-case hex denote the same DID, the canonical form is lowercase, and
    // a resolver MUST emit it that way (docs/xny-did-method.md:73-86). Normalizing here
    // rather than per backend is what makes that true for both: the subgraph keys its
    // entities by the lowercase form and would answer 404 for an upper-case spelling,
    // while the rpc backend parses either and would otherwise echo the caller's casing
    // back into id, controller and every fragment of the document it built.
    const identifier = rawIdentifier.toLowerCase();

    try {
      const didDoc = await this.backend.fetch(identifier);

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
          // Discard the blob's attempts at the three fields the resolver is
          // responsible for, and spread what remains: key material and
          // method-specific fields still come through, which is the point of the
          // spread.
          //
          // These used to be assigned before the spread, so a blob carrying its own
          // `id` displaced the `#vm_<index>` name derived from the array position —
          // and every relationship entry pointing at that name was then left
          // dereferencing nothing. `authentication` would name `#vm_0` while the
          // only method in the document called itself something else, so the DID
          // could not be used to authenticate at all. The id it supplied could also
          // name a fragment of a DID it does not control.
          //
          // Naming them rather than relying on spread order both says what is being
          // dropped and keeps the field order the document has always had.
          const { id, type, controller, ...methodFields } = methodDetails;
          return {
            id: vm.id,
            type: vm.method.type,
            controller: didDoc.id,
            ...methodFields,
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
        // The indexer parses the on-chain JSON and validates it, then stores the
        // whole blob rather than the endpoint it just validated
        // (arrayAttributeHandler.ts:326-337), and the schema types that Bytes. So
        // what arrives here is the hex of `{"type":…,"serviceEndpoint":…}`, which
        // is not a value DID Core admits — it has to be a string URI, a map, or a
        // set of those, and a client cannot reach a service described by hex.
        //
        // Decoding here rather than at the indexer fixes both backends at once
        // (the rpc backend reproduces the stored shape on purpose) and needs no
        // reindex. The endpoint is read out by name rather than by spreading the
        // parsed object, so `id` stays `<did>#service_<index>` and an operator
        // cannot displace it.
        //
        // No fallback on the parse: a service entry only reaches this point once
        // it has already been parsed once — by the indexer before it created the
        // entity, or by the rpc backend before it appended the entry.
        // bytesToString, not ethers' default: the rpc backend proved this blob
        // parseable using the lenient decode, and a strict one here would reject
        // bytes it accepted — turning one operator's malformed service entry into
        // a 500 for the whole document.
        document.service = didDoc.service
          .map((svc) => ({
            id: svc.id,
            type: svc.type,
            serviceEndpoint: JSON.parse(bytesToString(svc.serviceEndpoint))
              .serviceEndpoint,
          }))
          // The indexer only checks that a serviceEndpoint key exists, so null,
          // numbers and booleans all reach this point. DID Core admits a string, a
          // map, or a set of those and nothing else, and an entry no client can
          // dial is worth less than no entry at all.
          .filter((svc) => isServiceEndpoint(svc.serviceEndpoint));
      }

      return document;
    } catch (error) {
      console.error(`\n❌ Query DID ${identifier} failed:`, error.message);
      if (error instanceof ResolveError) {
        throw error;
      }
      // Network / GraphQL / RPC transport failures map to internalError (500).
      throw new ResolveError(error.message, 500, 'internalError');
    }
  }
}

// config.get() throws on a missing key. That is the behaviour we want for the subgraph
// backend — a pod with no upstream configured should fail to start rather than come up
// healthy and return errors for every resolution — but the rpc backend has to boot with
// no configuration at all, so its keys are read through this instead.
function setting(key) {
  return config.has(key) ? config.get(key) : undefined;
}

// Reads a positive integer setting, refusing anything else. Coercing quietly would push
// the failure to request time — or, worse, past a `|| default` and into serving traffic
// against the wrong chain.
function integerSetting(key) {
  const raw = setting(key);
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} is not a positive integer: ${raw}`);
  }
  return value;
}

function createBackend() {
  const timeoutMs = integerSetting('RESOLVER_TIMEOUT_MS') || DEFAULT_TIMEOUT_MS;

  // Defaults to rpc: the published image runs on Universal Resolver infrastructure, where
  // no secret can be supplied. The self-hosted instances opt into subgraph explicitly.
  const backend = setting('RESOLVER_BACKEND') || 'rpc';

  if (backend === 'subgraph') {
    return new SubgraphBackend(
      config.get('RESOLVER_GRAPH_URL'),
      config.get('RESOLVER_GRAPH_ACCESS_TOKEN'),
      timeoutMs
    );
  }

  // Falling through to rpc on a typo would leave a pod healthy and quietly serving
  // production traffic off a public endpoint, where the only symptom is rate limiting.
  if (backend !== 'rpc') {
    throw new Error(
      `Unknown RESOLVER_BACKEND: ${backend} (expected "rpc" or "subgraph")`
    );
  }

  return new RpcBackend(
    setting('RESOLVER_RPC_URL'),
    setting('RESOLVER_REGISTRY_ADDRESS'),
    timeoutMs,
    integerSetting('RESOLVER_CHAIN_ID')
  );
}

const ResolverInstance = new Resolver(createBackend());

module.exports = ResolverInstance;
module.exports.Resolver = Resolver;
module.exports.ResolveError = ResolveError;
