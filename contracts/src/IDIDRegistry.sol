// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface IDIDRegistry {
    function register(uint128 identifier, address owner) external;
    function transferOwner(uint128 identifier, address to) external;
    function addItemToAttribute(uint128 identifier, uint128 operator, string calldata name, bytes calldata value) external;
}