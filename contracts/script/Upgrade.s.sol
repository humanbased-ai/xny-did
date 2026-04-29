// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";
import {DeploymentLib} from "./DeploymentLib.sol";

interface IUUPS {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external;
}

contract UpgradeScript is Script {
    DIDRegistry public registry;

    function run() public {
        DeploymentLib.Deployment memory d = DeploymentLib.load();
        require(d.registryProxy != address(0), "registryProxy missing in deployment.json");

        uint256 deployer = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployer);

        registry = new DIDRegistry();
        IUUPS(d.registryProxy).upgradeToAndCall(address(registry), bytes(""));

        vm.stopBroadcast();

        console.log("DIDRegistry new impl:", address(registry));

        d.registryImpl = address(registry);
        DeploymentLib.save(d);
    }

    function upgradeToV2() public {
        DeploymentLib.Deployment memory d = DeploymentLib.load();
        require(d.registryProxy != address(0), "registryProxy missing in deployment.json");

        uint256 deployer = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployer);

        registry = new DIDRegistry();
        bytes memory initData = abi.encodeWithSelector(DIDRegistry.initializeV2.selector);
        IUUPS(d.registryProxy).upgradeToAndCall(address(registry), initData);

        vm.stopBroadcast();

        console.log("DIDRegistry new impl:", address(registry));

        d.registryImpl = address(registry);
        DeploymentLib.save(d);
    }
}
