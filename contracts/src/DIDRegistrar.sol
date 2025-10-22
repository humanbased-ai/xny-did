// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract DIDRegistrar {
    // the contract address of DID registry
    address _registry;

    constructor() {
        
    }

    function register() public {

    }

    function setRegistry(address registry) public {
        _registry = registry;
    }
}