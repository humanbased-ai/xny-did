// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

library DIDGenerator {
    function randomUint128() internal view returns (uint128) {
        return uint128(uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender))));
    }
}
