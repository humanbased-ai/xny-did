// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

library DIDGenerator {
    // keccak256("did:xny:identifier:v1"). Fixed domain-separation salt for the
    // deterministic identifier scheme. Chain-independent: the same user id maps
    // to the same identifier on every deployment. Bump the version suffix to
    // roll out a new scheme.
    bytes32 internal constant DOMAIN_SALT = 0xbc878e26ec61bf617e002e90ebdcae39539722731c59b7bb10c543a72a07daf0;

    function randomUint128() internal view returns (uint128) {
        return uint128(uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender))));
    }

    /// @notice Deterministically derive a uint128 identifier from an off-chain user id.
    /// @dev identifier = uint128(uint256(keccak256(DOMAIN_SALT ++ utf8(userId)))). The
    ///      32-byte constant-length salt prefix removes any boundary ambiguity with the
    ///      variable-length user id, so the encoding is unambiguous and byte-reproducible
    ///      off-chain (see script/did_identifier.py and script/did_identifier_vectors.json).
    /// @param userId the off-chain user identifier, UTF-8 encoded
    /// @return the derived 128-bit identifier (low 128 bits of the keccak256 digest)
    function deterministicUint128(string memory userId) internal pure returns (uint128) {
        return uint128(uint256(keccak256(abi.encodePacked(DOMAIN_SALT, userId))));
    }
}
