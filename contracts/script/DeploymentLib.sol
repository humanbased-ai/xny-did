// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import {Vm} from "forge-std/Vm.sol";

/// @dev Shared helpers for the per-network configuration files under `script/`.
///
/// Two kinds under `script/config/`, both named `<kind>.<network>.json`, with `<network>`
/// derived from `block.chainid` via `script/config/networks.json` (unmapped ids fall back
/// to the decimal form, so a new chain needs no configuration):
///
///   - `deployment.<network>.json` — output. Contract addresses, written by the deploy
///     scripts as they run, accumulating over successive deployments.
///   - `roles.<network>.json` — input. The addresses a deployment should be configured
///     with, authored by hand. Not secrets; private keys stay in the environment.
///
/// Each file records its own `chainId`. That field — not the filename — is what gets
/// validated, so a manual rename or a numeric-fallback filename cannot silently pair one
/// chain's addresses with another chain's RPC. Reads are lenient about a file with no
/// `chainId` (those predate the check) and strict about one that disagrees.
///
/// The two kinds differ in how absence is treated. A missing deployment file is normal —
/// nothing has been deployed to that chain yet — so `load()` returns an empty struct. A
/// missing roles file is an error: deploying without knowing which addresses to configure
/// is exactly the mistake this indirection exists to prevent, and falling back to the
/// environment would silently restore it.
library DeploymentLib {
    struct Deployment {
        address registryImpl;
        address registryProxy;
        address registrar;
        address inviteRegistrar;
        address humanbasedRegistrar;
    }

    /// @dev Role addresses a deployment on this chain should be configured with.
    struct Roles {
        // DIDRegistry proxy owner, fixed at initialize() and not changeable afterwards.
        address owner;
        // The only address allowed to call HumanbasedRegistrar.register.
        address relayer;
        // Platform-custodial address recorded as the owner of newly registered DIDs.
        address platformOwner;
        // Invite service signing address for InviteRegistrar.
        address inviteSigner;
    }

    /// @dev The target file belongs to a different chain than the one being deployed to.
    error ChainIdMismatch(string path, uint256 recorded, uint256 actual);

    /// @dev No roles file for this chain. Create it rather than falling back to env.
    error RolesFileMissing(string path, uint256 chainId);

    /// @dev A role the caller requires is absent or the zero address in the roles file.
    error RoleMissing(string path, string role);

    /// @dev Load all known addresses for the current chain. Missing keys are left as address(0).
    ///      Returns an empty struct when no deployment file exists yet.
    function load() internal view returns (Deployment memory d) {
        Vm vm = _vm();
        string memory path = _path(vm, "deployment");
        if (!vm.exists(path)) return d;
        string memory json = vm.readFile(path);
        _requireChainId(vm, path, json);
        try vm.parseJsonAddress(json, "$.registryImpl") returns (address a) {
            d.registryImpl = a;
        } catch {}
        try vm.parseJsonAddress(json, "$.registryProxy") returns (address a) {
            d.registryProxy = a;
        } catch {}
        try vm.parseJsonAddress(json, "$.registrar") returns (address a) {
            d.registrar = a;
        } catch {}
        try vm.parseJsonAddress(json, "$.inviteRegistrar") returns (address a) {
            d.inviteRegistrar = a;
        } catch {}
        try vm.parseJsonAddress(json, "$.humanbasedRegistrar") returns (address a) {
            d.humanbasedRegistrar = a;
        } catch {}
    }

    /// @dev Load the role addresses configured for the current chain.
    ///      Absent keys are left as address(0); use `requireRole` for the ones a caller needs.
    ///      Reverts when there is no roles file — see the note on the library.
    function loadRoles() internal view returns (Roles memory r) {
        Vm vm = _vm();
        string memory path = _path(vm, "roles");
        if (!vm.exists(path)) {
            revert RolesFileMissing(path, block.chainid);
        }
        string memory json = vm.readFile(path);
        _requireChainId(vm, path, json);
        try vm.parseJsonAddress(json, "$.owner") returns (address a) {
            r.owner = a;
        } catch {}
        try vm.parseJsonAddress(json, "$.relayer") returns (address a) {
            r.relayer = a;
        } catch {}
        try vm.parseJsonAddress(json, "$.platformOwner") returns (address a) {
            r.platformOwner = a;
        } catch {}
        try vm.parseJsonAddress(json, "$.inviteSigner") returns (address a) {
            r.inviteSigner = a;
        } catch {}
    }

    /// @dev Assert a role the caller depends on is actually set, naming it and the file.
    ///      Callers need only the roles relevant to what they deploy, so this is per-field
    ///      rather than a blanket check inside loadRoles().
    function requireRole(address value, string memory role) internal view {
        if (value == address(0)) {
            revert RoleMissing(_path(_vm(), "roles"), role);
        }
    }

    /// @dev Persist deployment addresses for the current chain with newline formatting.
    ///      address(0) fields are omitted from output; `chainId` is always written.
    ///      Reverts rather than overwriting a file that records a different chain.
    function save(Deployment memory d) internal {
        Vm vm = _vm();
        string memory path = _path(vm, "deployment");
        if (vm.exists(path)) {
            _requireChainId(vm, path, vm.readFile(path));
        }
        string memory body = _buildBody(vm, d, block.chainid);
        vm.writeFile(path, string.concat("{\n", body, "\n}\n"));
    }

    /// @dev Reverts if `json` records a chainId other than the current one. A file with no
    ///      chainId field predates this check and is accepted as-is; a field that is present
    ///      but unparsable (e.g. quoted as a string) propagates, since swallowing it would
    ///      silently disable the check on exactly the hand-edited files that need it most.
    function _requireChainId(Vm vm, string memory path, string memory json) private view {
        if (!vm.keyExistsJson(json, "$.chainId")) return;
        uint256 recorded = vm.parseJsonUint(json, "$.chainId");
        if (recorded != block.chainid) {
            revert ChainIdMismatch(path, recorded, block.chainid);
        }
    }

    function _buildBody(Vm vm, Deployment memory d, uint256 chainId) private pure returns (string memory out) {
        out = string.concat('  "chainId": ', vm.toString(chainId));
        out = _entry(vm, out, "registryImpl", d.registryImpl);
        out = _entry(vm, out, "registryProxy", d.registryProxy);
        out = _entry(vm, out, "registrar", d.registrar);
        out = _entry(vm, out, "inviteRegistrar", d.inviteRegistrar);
        out = _entry(vm, out, "humanbasedRegistrar", d.humanbasedRegistrar);
    }

    /// @dev Appends a JSON key-value line to `acc`, separated by ",\n" when acc is non-empty.
    ///      Returns acc unchanged if val is address(0).
    function _entry(Vm vm, string memory acc, string memory key, address val) private pure returns (string memory) {
        if (val == address(0)) return acc;
        string memory line = string.concat('  "', key, '": "', vm.toString(val), '"');
        if (bytes(acc).length == 0) return line;
        return string.concat(acc, ",\n", line);
    }

    /// @dev `script/config/<kind>.<network>.json`, e.g. _path(vm, "deployment") or
    ///      _path(vm, "roles").
    function _path(Vm vm, string memory kind) private view returns (string memory) {
        return string.concat(_configDir(vm), kind, ".", _networkName(vm), ".json");
    }

    /// @dev The per-network config directory. These files are the only ones under script/
    ///      whose count grows — two more per network — so they live together rather than
    ///      alongside the scripts, ABIs and tooling.
    function _configDir(Vm vm) private view returns (string memory) {
        return string.concat(vm.projectRoot(), "/script/config/");
    }

    /// @dev Maps the current chain id to a human-readable name via script/config/networks.json,
    ///      falling back to the decimal chain id when the map is absent or has no entry.
    ///      A chain id that IS mapped but unreadable is a real error and propagates —
    ///      it must not degrade into the numeric filename, or a broken map would quietly
    ///      split one network's addresses across two files.
    function _networkName(Vm vm) private view returns (string memory) {
        string memory chainId = vm.toString(block.chainid);
        string memory mapPath = string.concat(_configDir(vm), "networks.json");
        if (!vm.exists(mapPath)) return chainId;
        string memory json = vm.readFile(mapPath);
        string memory key = string.concat("$['", chainId, "']");
        if (!vm.keyExistsJson(json, key)) return chainId;
        return vm.parseJsonString(json, key);
    }

    function _vm() private pure returns (Vm) {
        return Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    }
}
