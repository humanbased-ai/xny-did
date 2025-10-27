// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";

uint128 constant DID_IDENTIFIER_0 = 0;

contract DIDRegistryTest is Test {
    DIDRegistry public proxy;

    address internal _owner;
    uint256 internal _ownerKey;

    address internal _user;
    uint256 internal _userKey;

    function setUp() public {
        (_owner, _ownerKey) = makeAddrAndKey("owner");
        (_user, _userKey) = makeAddrAndKey("user");
        DIDRegistry registry = new DIDRegistry();
        bytes memory initData = abi.encodeWithSelector(DIDRegistry.initialize.selector, _owner);
        ERC1967Proxy proxy1967 = new ERC1967Proxy(address(registry), initData);
        proxy = DIDRegistry(address(proxy1967));
    }

    function _addRegistrar(address _registrar) internal {
        vm.prank(_owner);
        address[] memory addings = new address[](1);
        addings[0] = _registrar;
        proxy.updateRegistrars(addings, new address[](0));
    }


    function test_initialize_should_pass() public {
        address owner = proxy.owner();
        vm.assertEq(owner, _owner);
    }

    function test_initialize_should_fail_with_reinitialing() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                Initializable.InvalidInitialization.selector
            )
        );
        proxy.initialize(_owner);
    }

    function test_updateRegistrars_should_fail_with_caller_not_owner() public {
        vm.prank(_user);
        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector,
                _user
            )
        );
        proxy.updateRegistrars(new address[](0), new address[](0));
    }

    function test_updateRegistrars_should_pass_with_caller_is_owner() public {
        vm.startPrank(_owner);

        address[] memory addings = new address[](1);
        addings[0] = _user;
        proxy.updateRegistrars(addings, new address[](0));

        address[] memory registrars = proxy.getRegistrars();
        vm.assertEq(registrars.length, 1);
        vm.assertEq(registrars[0], _user);

        address[] memory removings = new address[](1);
        removings[0] = _user;
        proxy.updateRegistrars(new address[](0), removings);
        registrars = proxy.getRegistrars();
        vm.assertEq(registrars.length, 0);
    }

    function test_register_should_fail_with_not_registrar() public {
        vm.prank(_owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                DIDRegistry.NotRegistrar.selector,
                _owner
            )
        );
        proxy.register(DID_IDENTIFIER_0, _owner);
    }

    function test_register_should_pass_with_called_by_registrar() public {
        _addRegistrar(_user);

        vm.startPrank(_user);
        vm.expectEmit(true, false, false, true);
        emit DIDRegistry.DIDRegistered(DID_IDENTIFIER_0, _user);
        proxy.register(DID_IDENTIFIER_0, _user);
    }

    function test_register_should_fail_with_did_exists() public {
        _addRegistrar(_user);

        vm.startPrank(_user);
        proxy.register(DID_IDENTIFIER_0, _user);
        vm.expectRevert(
            abi.encodeWithSelector(
                DIDRegistry.DIDAlreadyRegistered.selector,
                DID_IDENTIFIER_0,
                _user
            )
        );
        proxy.register(DID_IDENTIFIER_0, _user);
    }

    // function test_addItemToAttribute_should_fail_with_not_controller() public {
    //     vm.expectRevert(
    //         abi.encodeWithSelector(
    //             DIDRegistry.NotController.selector,
    //             DID_IDENTIFIER_0,
    //             _user
    //         )
    //     );
    //     proxy.register(DID_IDENTIFIER_0, _user);
    // }
}
