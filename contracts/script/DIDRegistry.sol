// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";

contract DIDRegistryScript is Script {
    DIDRegistry public registry;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        registry = new DIDRegistry();

        vm.stopBroadcast();
    }
}
