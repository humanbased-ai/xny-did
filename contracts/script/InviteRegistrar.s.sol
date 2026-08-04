// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {InviteRegistrar} from "../src/InviteRegistrar.sol";
import {DeploymentLib} from "./DeploymentLib.sol";

/// @notice Deploy InviteRegistrar bound to the existing DIDRegistry proxy.
///
/// Env vars:
///   DEPLOYER_PRIVATE_KEY — deployer key
///
/// `inviteSigner` comes from script/config/roles.<network>.json. Reads `registryProxy`
/// from script/config/deployment.<network>.json.
contract InviteRegistrarScript is Script {
    InviteRegistrar public inviteRegistrar;

    function run() public {
        DeploymentLib.Deployment memory d = DeploymentLib.load();
        require(d.registryProxy != address(0), "registryProxy missing in deployment file");

        DeploymentLib.Roles memory roles = DeploymentLib.loadRoles();
        DeploymentLib.requireRole(roles.inviteSigner, "inviteSigner");
        address inviteSigner = roles.inviteSigner;
        uint256 deployer = vm.envUint("DEPLOYER_PRIVATE_KEY");

        console.log("chain id:", block.chainid);
        console.log("inviteSigner:", inviteSigner);

        vm.startBroadcast(deployer);
        inviteRegistrar = new InviteRegistrar(d.registryProxy, inviteSigner);
        vm.stopBroadcast();

        console.log("InviteRegistrar:", address(inviteRegistrar));

        d.inviteRegistrar = address(inviteRegistrar);
        DeploymentLib.save(d);
    }
}
