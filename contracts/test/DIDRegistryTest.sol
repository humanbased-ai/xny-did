// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {DIDRegistry} from "../src/DIDRegistry.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

string constant KV_ATTRIBUTE_NAME = "kv_attribute_name";

contract DIDRegistryForTest is DIDRegistry {
    using EnumerableSet for EnumerableSet.StringSet;

    function addKvAttributeNames() public {
        _kvAttributeNames.add(KV_ATTRIBUTE_NAME);
    }
}