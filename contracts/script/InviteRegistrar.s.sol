// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {InviteRegistrar} from "../src/InviteRegistrar.sol";
import {DeploymentLib} from "./DeploymentLib.sol";

/// @notice Deploy InviteRegistrar bound to the existing DIDRegistry proxy.
///
/// Env vars:
///   DEPLOYER_PRIVATE_KEY — deployer key
///   INVITE_SIGNER        — invite service signing address
///
/// Reads `registryProxy` from script/deployment.json.
contract InviteRegistrarScript is Script {
    InviteRegistrar public inviteRegistrar;

    function run() public {
        DeploymentLib.Deployment memory d = DeploymentLib.load();
        require(d.registryProxy != address(0), "registryProxy missing in deployment.json");

        address inviteSigner = vm.envAddress("INVITE_SIGNER");
        uint256 deployer = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployer);
        inviteRegistrar = new InviteRegistrar(d.registryProxy, inviteSigner);
        vm.stopBroadcast();

        console.log("InviteRegistrar:", address(inviteRegistrar));

        d.inviteRegistrar = address(inviteRegistrar);
        DeploymentLib.save(d);
    }
}
