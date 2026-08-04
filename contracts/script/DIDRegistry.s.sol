// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";
import {DeploymentLib} from "./DeploymentLib.sol";

/// @notice Deploy DIDRegistry behind an ERC1967 proxy.
///
/// Env vars:
///   DEPLOYER_PRIVATE_KEY — deployer key, pays gas
///
/// The proxy owner comes from `owner` in script/roles.<network>.json. It is fixed at
/// initialize() and cannot be changed afterwards, so getting it wrong means redeploying —
/// which is why it is read from a chainId-validated file rather than the environment.
contract DIDRegistryScript is Script {
    DIDRegistry public registry;
    ERC1967Proxy public proxy;

    function run() public {
        uint256 deployer = vm.envUint("DEPLOYER_PRIVATE_KEY");
        DeploymentLib.Roles memory roles = DeploymentLib.loadRoles();
        DeploymentLib.requireRole(roles.owner, "owner");
        address ownerAddress = roles.owner;

        console.log("chain id:", block.chainid);
        console.log("proxy owner:", ownerAddress);

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
