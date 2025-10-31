// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";

interface IUUPS {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external;
}

contract UpgradeScript is Script {
    DIDRegistry public registry;
    
    function run() public {
        string memory root = vm.projectRoot();
        string memory deployRegistryPath = string.concat(root, "/script/deploymentRegistry.json");
        string memory json = vm.readFile(deployRegistryPath);
        address proxy = vm.parseJsonAddress(json, "$.proxy");
        
        uint256 deployer = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployer);

        registry = new DIDRegistry();
        IUUPS(proxy).upgradeToAndCall(address(registry), bytes(""));

        vm.stopBroadcast();
    }
}
