// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";
import {IDIDRegistry} from "../src/IDIDRegistry.sol";
import {DIDRegistrar} from "../src/DIDRegistrar.sol";
import {SystemAttribute} from "../src/lib/SystemAttribute.sol";

uint128 constant DID_IDENTIFIER_0 = 0;

contract DIDRegistrarTest is Test {
    DIDRegistry public proxy;
    DIDRegistrar public registrarContract;

    address internal _owner;
    uint256 internal _ownerKey;

    address internal _registrar;
    uint256 internal _registrarKey;

    address internal _user;
    uint256 internal _userKey;

    function setUp() public {
        (_owner, _ownerKey) = makeAddrAndKey("owner");
        (_registrar, _registrarKey) = makeAddrAndKey("registrar");
        (_user, _userKey) = makeAddrAndKey("user");

        DIDRegistry registry = new DIDRegistry();
        bytes memory initData = abi.encodeWithSelector(DIDRegistry.initialize.selector, _owner);
        ERC1967Proxy proxy1967 = new ERC1967Proxy(address(registry), initData);
        proxy = DIDRegistry(address(proxy1967));

        registrarContract = new DIDRegistrar(address(proxy1967));

        vm.prank(_owner);
        address[] memory addings = new address[](1);
        addings[0] = address(registrarContract);
        proxy.updateRegistrars(addings, new address[](0));
    }

    // function test_register_should_pass() public {
    //     vm.startPrank(_user);
    //     registrarContract.register();
    //     uint128[] memory identifiers = proxy.ownedDids(_user);
    //     vm.assertEq(identifiers.length, 1);
    //     console.log("identifier", identifiers[0]);
    // }

    function test_registerWithAuthorization_should_pass() public {
        vm.startPrank(_user);
        bytes[] memory authorizations = new bytes[](3);
        authorizations[0] = bytes("1");
        authorizations[1] = bytes("2");
        authorizations[2] = bytes("3");
        registrarContract.registerWithAuthorization(authorizations);

        uint128[] memory identifiers = proxy.getOwnedDids(_user);
        vm.assertEq(identifiers.length, 1);

        (uint256 id, address owner, uint128[] memory controller, IDIDRegistry.KvAttribute[] memory kvAttributes, IDIDRegistry.ArrayAttribute[] memory arrayAttributes) =
            proxy.getDidDocument(identifiers[0]);
        vm.assertEq(id, identifiers[0]);
        vm.assertEq(owner, _user);
        vm.assertEq(controller.length, 0);
        for (uint256 i = 0; i < arrayAttributes.length; i++){
            if (keccak256(bytes(arrayAttributes[i].name)) == keccak256(bytes(SystemAttribute.ARRAY_ATTRIBUTE_VERIFICATION_METHOD))) {
                vm.assertEq(arrayAttributes[i].values.length, 3);
            }

            if (keccak256(bytes(arrayAttributes[i].name)) == keccak256(bytes(SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION))) {
                vm.assertEq(arrayAttributes[i].values.length, 3);
            }
        }
    }
}