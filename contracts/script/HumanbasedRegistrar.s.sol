// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {HumanbasedRegistrar} from "../src/HumanbasedRegistrar.sol";
import {DeploymentLib} from "./DeploymentLib.sol";

/// @notice Deploy HumanbasedRegistrar bound to the existing DIDRegistry proxy.
///
/// Relayer-only registrar for precomputed, deterministic `did:xny` identifiers
/// (see ../src/HumanbasedRegistrar.sol). The deployer becomes the contract's
/// admin (Ownable); admin can rotate the relayer and the platform-custodial
/// owner address post-deploy via setRelayer / setPlatformOwner.
///
/// Env vars:
///   DEPLOYER_PRIVATE_KEY  — deployer key (becomes the admin / Ownable owner)
///   RELAYER_ADDRESS       — backend relayer; the only address allowed to call `register`
///   PLATFORM_OWNER_ADDRESS — platform-custodial address recorded as the DID owner
///
/// Reads `registryProxy` from script/deployment.json and writes
/// `humanbasedRegistrar` back on success.
contract HumanbasedRegistrarScript is Script {
    HumanbasedRegistrar public humanbasedRegistrar;

    function run() public {
        DeploymentLib.Deployment memory d = DeploymentLib.load();
        require(d.registryProxy != address(0), "registryProxy missing in deployment.json");

        address relayer = vm.envAddress("RELAYER_ADDRESS");
        address platformOwner = vm.envAddress("PLATFORM_OWNER_ADDRESS");
        uint256 deployer = vm.envUint("DEPLOYER_PRIVATE_KEY");

        if (relayer == address(0) || platformOwner == address(0)) {
            revert HumanbasedRegistrar.ZeroAddress();
        }

        vm.startBroadcast(deployer);
        humanbasedRegistrar = new HumanbasedRegistrar(d.registryProxy, relayer, platformOwner);
        vm.stopBroadcast();

        console.log("HumanbasedRegistrar:", address(humanbasedRegistrar));
        console.log("  relayer:        ", humanbasedRegistrar.relayer());
        console.log("  platformOwner:  ", humanbasedRegistrar.platformOwner());

        d.humanbasedRegistrar = address(humanbasedRegistrar);
        DeploymentLib.save(d);
    }
}
