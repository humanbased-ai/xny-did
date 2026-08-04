// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {HumanbasedRegistrar} from "../src/HumanbasedRegistrar.sol";
import {DeploymentLib} from "./DeploymentLib.sol";

/// @notice Rotate HumanbasedRegistrar's admin-controlled addresses.
///
/// Both rotations are `onlyOwner` on the contract. The target address is read from
/// script/config/deployment.<network>.json, so the chainId cross-check in DeploymentLib
/// applies — one network's registrar cannot be addressed over another network's RPC.
///
/// Env vars:
///   DEPLOYER_PRIVATE_KEY — must be the contract's Ownable owner
///
/// The target values come from script/config/roles.<network>.json, which makes that file the
/// desired state and this script the thing that makes the chain converge to it. Edit the
/// file, run the script, and the file stays equal to what is on chain. Taking the new
/// address from the environment instead would let the file drift the moment anyone
/// rotates — which is what the addresses lived in .env for, before IN-2861.
///
/// Usage:
///   forge script script/HumanbasedRegistrarAdmin.s.sol:HumanbasedRegistrarAdminScript \
///     --sig 'setRelayer()' --rpc-url <url> --broadcast
///
/// Note that `relayer` is a single address, not a set: the old relayer stops being
/// able to call `register` the moment this lands. Point the backend at the new key
/// before rotating, not after.
contract HumanbasedRegistrarAdminScript is Script {
    /// @dev The signing key is not the contract's owner; the rotation would revert on-chain.
    error NotOwner(address owner, address signer);

    /// @notice Rotate the relayer — the only address allowed to call `register`.
    function setRelayer() public {
        (HumanbasedRegistrar registrar, uint256 deployer) = _loadAsOwner();
        DeploymentLib.Roles memory roles = DeploymentLib.loadRoles();
        DeploymentLib.requireRole(roles.relayer, "relayer");
        address newRelayer = roles.relayer;
        address current = registrar.relayer();

        if (current == newRelayer) {
            console.log("relayer already set, nothing to do:", current);
            return;
        }

        console.log("relayer old:", current);
        console.log("relayer new:", newRelayer);

        vm.startBroadcast(deployer);
        registrar.setRelayer(newRelayer);
        vm.stopBroadcast();
    }

    /// @notice Rotate the platform-custodial owner recorded on newly registered DIDs.
    ///
    /// @dev Only affects subsequent registrations. Already-registered DIDs keep their
    ///      existing owner, and their claim path still runs through that address —
    ///      migrating them requires `transferOwner` signed by the current owner.
    function setPlatformOwner() public {
        (HumanbasedRegistrar registrar, uint256 deployer) = _loadAsOwner();
        DeploymentLib.Roles memory roles = DeploymentLib.loadRoles();
        DeploymentLib.requireRole(roles.platformOwner, "platformOwner");
        address newPlatformOwner = roles.platformOwner;
        address current = registrar.platformOwner();

        if (current == newPlatformOwner) {
            console.log("platformOwner already set, nothing to do:", current);
            return;
        }

        console.log("platformOwner old:", current);
        console.log("platformOwner new:", newPlatformOwner);

        vm.startBroadcast(deployer);
        registrar.setPlatformOwner(newPlatformOwner);
        vm.stopBroadcast();
    }

    /// @dev Resolves the registrar for the current chain and asserts the signing key owns it,
    ///      so a wrong key fails here rather than as an OwnableUnauthorizedAccount revert
    ///      from a broadcast transaction.
    function _loadAsOwner() private view returns (HumanbasedRegistrar registrar, uint256 deployer) {
        DeploymentLib.Deployment memory d = DeploymentLib.load();
        require(d.humanbasedRegistrar != address(0), "humanbasedRegistrar missing in deployment file");

        registrar = HumanbasedRegistrar(d.humanbasedRegistrar);
        deployer = vm.envUint("DEPLOYER_PRIVATE_KEY");

        address owner = registrar.owner();
        address signer = vm.addr(deployer);
        if (owner != signer) {
            console.log("HumanbasedRegistrar:", address(registrar));
            console.log("  contract owner:   ", owner);
            console.log("  signing key:      ", signer);
            revert NotOwner(owner, signer);
        }

        console.log("HumanbasedRegistrar:", address(registrar));
    }
}
