const uuid = require('uuid');
/**
 * Parse the string in the format "did:codatta:ID"
 * It will verify the prefix and ensure that the ID is a valid uint128.
 * @param {string} didString A complete DID string, e.g. "did:codatta:38564"
 * @returns {string} If validation passes, returns the ID string (e.g. "38564")
 * @throws {Error} If the format is invalid or the ID is out of range, throws an exception
 */
function toBigInt(didString) {
  if (!didString || typeof didString !== 'string') {
    throw new Error('Input must be a non-empty string.');
  }

  const parts = didString.split(':');

  if (parts.length !== 3) {
    throw new Error(
      `The format is invalid. It should be 'did:codatta:ID', but received is '${didString}'`
    );
  }

  if (parts[0] !== 'did' || parts[1] !== 'codatta') {
    throw new Error(
      `The prefix is invalid. It should be “did:codatta:” but received '${parts[0]}:${parts[1]}:'`
    );
  }

  const idString = parts[2];

  const isValidUUID = uuid.validate(idString);
  if (!isValidUUID) {
    throw new Error(
      `The ID is partially invalid. It should be a valid UUID, but what was received is '${idString}'`
    );
  }
  if (idString.length === 0) {
    throw new Error('The ID field cannot be empty.');
  }

  const hex = idString.replace(/-/g, '');
  return BigInt('0x' + hex);
}

function fromBigInt(num) {
  let hex = num.toString(16);
  hex = hex.padStart(32, '0');
  const uuid = hex.replace(
    /(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/,
    '$1-$2-$3-$4-$5'
  );
  return 'did:codatta:' + uuid;
}
module.exports = {
  toBigInt,
  fromBigInt,
};
