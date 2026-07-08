// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Vm} from "forge-std/Vm.sol";

/// @dev Shared helpers for reading/writing script/deployment.json with pretty-printed output.
library DeploymentLib {
    struct Deployment {
        address registryImpl;
        address registryProxy;
        address registrar;
        address inviteRegistrar;
        address humanbasedRegistrar;
    }

    /// @dev Load all known addresses from deployment.json. Missing keys are left as address(0).
    function load() internal view returns (Deployment memory d) {
        Vm vm = _vm();
        string memory path = _path(vm);
        if (!vm.exists(path)) return d;
        string memory json = vm.readFile(path);
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

    /// @dev Persist deployment addresses to deployment.json with newline formatting.
    ///      address(0) fields are omitted from output.
    function save(Deployment memory d) internal {
        Vm vm = _vm();
        string memory body = _buildBody(vm, d);
        vm.writeFile(_path(vm), string.concat("{\n", body, "\n}\n"));
    }

    function _buildBody(Vm vm, Deployment memory d) private pure returns (string memory out) {
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
        return string.concat(vm.projectRoot(), "/script/deployment.json");
    }

    function _vm() private pure returns (Vm) {
        return Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    }
}
