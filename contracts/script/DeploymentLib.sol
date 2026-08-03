// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import {Vm} from "forge-std/Vm.sol";

/// @dev Shared helpers for reading/writing per-network deployment files with pretty-printed output.
///
/// The file is `script/deployment.<network>.json`, where `<network>` is derived from
/// `block.chainid` via `script/networks.json`. An unmapped chain id falls back to its
/// decimal form, so a new chain needs no configuration to work.
///
/// Each file records its own `chainId`. That field — not the filename — is what
/// `load()` and `save()` validate against, so a manual rename or a numeric-fallback
/// filename cannot silently pair one chain's addresses with another chain's RPC.
/// Reads are lenient (a file without the field skips the check and gains one on the
/// next save); writes are strict.
library DeploymentLib {
    struct Deployment {
        address registryImpl;
        address registryProxy;
        address registrar;
        address inviteRegistrar;
        address humanbasedRegistrar;
    }

    /// @dev The target file belongs to a different chain than the one being deployed to.
    error ChainIdMismatch(string path, uint256 recorded, uint256 actual);

    /// @dev Load all known addresses for the current chain. Missing keys are left as address(0).
    ///      Returns an empty struct when no deployment file exists yet.
    function load() internal view returns (Deployment memory d) {
        Vm vm = _vm();
        string memory path = _path(vm);
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

    /// @dev Persist deployment addresses for the current chain with newline formatting.
    ///      address(0) fields are omitted from output; `chainId` is always written.
    ///      Reverts rather than overwriting a file that records a different chain.
    function save(Deployment memory d) internal {
        Vm vm = _vm();
        string memory path = _path(vm);
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

    function _path(Vm vm) private view returns (string memory) {
        return string.concat(vm.projectRoot(), "/script/deployment.", _networkName(vm), ".json");
    }

    /// @dev Maps the current chain id to a human-readable name via script/networks.json,
    ///      falling back to the decimal chain id when the map is absent or has no entry.
    ///      A chain id that IS mapped but unreadable is a real error and propagates —
    ///      it must not degrade into the numeric filename, or a broken map would quietly
    ///      split one network's addresses across two files.
    function _networkName(Vm vm) private view returns (string memory) {
        string memory chainId = vm.toString(block.chainid);
        string memory mapPath = string.concat(vm.projectRoot(), "/script/networks.json");
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
