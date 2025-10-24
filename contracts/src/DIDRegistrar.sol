// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {SystemAttribute} from "./lib/SystemAttribute.sol";
import {IDIDRegistry} from "./IDIDRegistry.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract DIDRegistrar {
    // the contract address of DID registry
    IDIDRegistry _registry;

    constructor() {
        
    }

    function register() public {

    }

    /**
     * @notice Register DID and add authorization methods
     * @param authorizations Authorization methods to be added, each authorization is the bytes value of json string of an authorization method.
     * For example, for a authorization type `A`, the data is `B`, the json object is {type: "A", data: "B"}. Serialize the object to json string,
     *  and then convert it to bytes.
     */
    function registerWithAuthorization(bytes[] calldata authorizations) public {
        uint128 identifier = 120;
        _registry.register(identifier, address(this));

        for (uint256 i = 0; i < authorizations.length; ++i) {
            _registry.addItemToAttribute(identifier, identifier, SystemAttribute.ARRAY_ATTRIBUTE_VERIFICATION_METHOD, authorizations[i]);
            _registry.addItemToAttribute(identifier, identifier, SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION,
                abi.encodePacked(Strings.toString(uint256(identifier)), "#", Strings.toString(i)));
        }

        _registry.transferOwner(identifier, msg.sender);
    }

    function setRegistry(address registry) public {
        _registry = IDIDRegistry(registry);
    }
}