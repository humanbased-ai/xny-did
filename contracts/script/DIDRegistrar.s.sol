// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {DIDRegistrar} from "../src/DIDRegistrar.sol";

contract DIDRegistrarScript is Script {

    DIDRegistrar public registrar;

    function setUp() public {}

    function run() public {
        string memory root = vm.projectRoot();
        string memory deployRegistryPath = string.concat(root, "/script/deploymentRegistry.json");
        string memory json = vm.readFile(deployRegistryPath);
        address proxy = vm.parseJsonAddress(json, "$.proxy");

        uint256 deployer = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployer);

        registrar = new DIDRegistrar(proxy);

        vm.stopBroadcast();

        string memory deployRegistrarPath = string.concat(root, "/script/deploymentRegistrar.json");
        if (vm.exists(deployRegistrarPath)) {
            vm.removeFile(deployRegistrarPath);
        }
        vm.writeFile(deployRegistrarPath, vm.serializeAddress("", "registrar", proxy));
    }
}
