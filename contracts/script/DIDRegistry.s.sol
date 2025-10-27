// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";

contract DIDRegistryScript is Script {
    DIDRegistry public registry;
    ERC1967Proxy public proxy;

    function setUp() public {}

    function run() public {
        uint256 deployer = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address ownerAddress = vm.envAddress("OWNER");
        vm.startBroadcast(deployer);

        registry = new DIDRegistry();
        bytes memory initData = abi.encodeWithSelector(DIDRegistry.initialize.selector, ownerAddress);
        ERC1967Proxy proxy1967 = new ERC1967Proxy(address(registry), initData);
        proxy = proxy1967;

        vm.stopBroadcast();

        string memory root = vm.projectRoot();
        string memory deployPath = string.concat(root, "/script/deploymentRegistry.json");
        if (vm.exists(deployPath)) {
            vm.removeFile(deployPath);
        }
        vm.writeFile(deployPath, vm.serializeAddress("", "registry", address(registry)));
        vm.writeFile(deployPath, vm.serializeAddress("", "proxy", address(proxy)));
    }
}
