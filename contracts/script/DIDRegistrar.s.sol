// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {DIDRegistrar} from "../src/DIDRegistrar.sol";
import {DeploymentLib} from "./DeploymentLib.sol";

contract DIDRegistrarScript is Script {
    DIDRegistrar public registrar;

    function run() public {
        DeploymentLib.Deployment memory d = DeploymentLib.load();
        require(d.registryProxy != address(0), "registryProxy missing in deployment.json");

        uint256 deployer = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployer);

        registrar = new DIDRegistrar(d.registryProxy);

        vm.stopBroadcast();

        console.log("DIDRegistrar:", address(registrar));

        d.registrar = address(registrar);
        DeploymentLib.save(d);
    }
}
