'use strict';

const ethers = require('ethers');

// Attribute values arrive as the bytes an operator wrote on-chain. The rpc backend has
// to reach the same verdict about those bytes that the indexer reached, or the two
// backends answer differently for the same DID — and being indistinguishable is the
// whole basis of the two-backend design.
//
// The indexer does not use one decoder, it uses two, and they disagree with each other.
// Measured against graph-node in services/indexer/tests/utf8.test.ts:
//
//   Bytes.toString()      substitutes U+FFFD per malformed byte and keeps going
//   json.try_fromBytes()  rejects the whole blob, so no entity is ever created
//
// So this module exposes two decoders rather than one, each matching the indexer
// function that handles the same kind of value.

// For values the indexer decodes with `Bytes.toString()`: `alsoKnownAs`, and the
// numeric and DID-string relation values.
//
// Node's decoder is used rather than ethers' `Utf8ErrorFuncs.replace` because the two
// disagree on overlong encodings. Given the bytes 0xc0 0xaf — a second, illegal
// spelling of '/' — ethers emits the codepoint it spells, so the value becomes
// indistinguishable from a genuine '/' that no one wrote on-chain. graph-node and Node
// both emit two replacement characters. `getBytes` is still ethers' so that a value
// that is not valid hex fails here exactly as it did before.
function bytesToString(hexValue) {
  return Buffer.from(ethers.getBytes(hexValue)).toString('utf8');
}

// For the operator-authored JSON blobs: verification methods, services, and object
// valued relation entries. The indexer parses these straight off the raw bytes with
// `json.try_fromBytes` and abandons the item when that fails, so malformed UTF-8 means
// the subgraph holds nothing at all for it.
//
// The decode is therefore strict: `toUtf8String` throws on malformed input, the catch
// turns that into null, and every caller already treats null as "the indexer would not
// have stored this". A lenient decode here would let the rpc backend serve a
// verification method that the subgraph backend has no row for.
//
// Returning null for a non-object also keeps one guard in one place, so no caller can
// spread a string's indices in as fields or throw destructuring a null.
function parseJsonObject(hexValue) {
  let parsed;
  try {
    parsed = JSON.parse(ethers.toUtf8String(hexValue));
  } catch (e) {
    return null;
  }
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed
    : null;
}

module.exports = { bytesToString, parseJsonObject };
