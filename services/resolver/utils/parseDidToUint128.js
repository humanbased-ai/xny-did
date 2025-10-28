const MAX_UINT_128 = 2n ** 128n - 1n;

/**
 * Parse the string in the format "did:codatta:ID"
 * It will verify the prefix and ensure that the ID is a valid uint128.
 * @param {string} didString A complete DID string, e.g. "did:codatta:38564"
 * @returns {string} If validation passes, returns the ID string (e.g. "38564")
 * @throws {Error} If the format is invalid or the ID is out of range, throws an exception
 */
function parseDidToUint128(didString) {
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

  const isNumericString = /^\d+$/.test(idString);
  if (!isNumericString) {
    throw new Error(
      `The ID is partially invalid. It should be an unsigned integer, but what was received is '${idString}'`
    );
  }
  if (idString.length === 0) {
    throw new Error('The ID field cannot be empty.');
  }
  let numericId;
  try {
    numericId = BigInt(idString);
  } catch (e) {
    throw new Error(
      `Cannot convert ID '${idString}' to a number: ${e.message}`
    );
  }

  if (numericId > MAX_UINT_128) {
    throw new Error(
      `ID exceeds the range. '${idString}' is greater than the maximum value of uint128.`
    );
  }

  return idString;
}

module.exports = {
  parseDidToUint128,
};
