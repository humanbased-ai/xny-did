'use strict';

const ethers = require('ethers');

// Attribute values arrive as the bytes an operator wrote on-chain, and every place
// that turns them back into text has to agree on what "invalid UTF-8" means. The
// indexer's graph-ts `Bytes.toString()` substitutes replacement characters rather
// than failing, so the rpc backend does too — and the document assembly, which
// decodes some of the same bytes a second time, must use this and not ethers'
// default.
//
// Splitting decoders here is not cosmetic: a strict decode downstream of a lenient
// one turns a value the backend accepted into a thrown error, which the resolver
// reports as a 500 for the whole document rather than for one bad entry.
function bytesToString(hexValue) {
  return ethers.toUtf8String(hexValue, ethers.Utf8ErrorFuncs.replace);
}

module.exports = { bytesToString };
