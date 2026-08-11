'use strict';

const ethers = require('ethers');

// Attribute values arrive as the bytes an operator wrote on-chain, and every place
// that turns them back into text has to agree on what "invalid UTF-8" means —
// a strict decode downstream of a lenient one turns a value one layer accepted into
// a thrown error, which the resolver reports as a 500 for the whole document rather
// than for the one bad entry.
//
// This substitutes rather than failing, matching graph-ts `Bytes.toString()`. That is
// the right analogue for the values the indexer decodes that way: `alsoKnownAs`, and
// the numeric and DID-string relation values. It is NOT established that it matches
// for JSON blobs — those the indexer parses straight off the raw bytes with
// `json.try_fromBytes`, and whether that rejects invalid UTF-8 outright is a
// graph-node host-function behaviour nothing in this repo can show. See IN-3167.
function bytesToString(hexValue) {
  return ethers.toUtf8String(hexValue, ethers.Utf8ErrorFuncs.replace);
}

// Decode an on-chain value and return it only if it is a JSON object. Everything that
// consumes an operator-authored blob goes through here, so that a value which cannot
// contribute fields is turned away in one place rather than reaching a caller that
// would spread a string's indices in as fields or throw destructuring a null.
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

module.exports = { bytesToString, parseJsonObject };
