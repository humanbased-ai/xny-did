// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";
import {DeploymentLib} from "./DeploymentLib.sol";

contract DIDRegistryScript is Script {
    DIDRegistry public registry;
    ERC1967Proxy public proxy;

    function run() public {
        uint256 deployer = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address ownerAddress = vm.envAddress("OWNER");
        vm.startBroadcast(deployer);

        registry = new DIDRegistry();
        bytes memory initData = abi.encodeWithSelector(DIDRegistry.initialize.selector, ownerAddress);
        proxy = new ERC1967Proxy(address(registry), initData);

        vm.stopBroadcast();

        console.log("DIDRegistry impl: ", address(registry));
        console.log("DIDRegistry proxy:", address(proxy));

        DeploymentLib.Deployment memory d = DeploymentLib.load();
        d.registryImpl = address(registry);
        d.registryProxy = address(proxy);
        DeploymentLib.save(d);
    }
}
