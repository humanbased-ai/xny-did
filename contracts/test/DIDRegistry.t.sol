// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {DIDRegistryForTest, KV_ATTRIBUTE_NAME} from "./DIDRegistryTest.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";
import {IDIDRegistry} from "../src/IDIDRegistry.sol";
import {SystemAttribute} from "../src/lib/SystemAttribute.sol";

uint128 constant DID_IDENTIFIER_0 = 0;
uint128 constant DID_IDENTIFIER_1 = 1;

contract DIDRegistryTest is Test {
    DIDRegistryForTest public proxy;

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

        DIDRegistryForTest registry = new DIDRegistryForTest();
        bytes memory initData = abi.encodeWithSelector(DIDRegistry.initialize.selector, _owner);
        ERC1967Proxy proxy1967 = new ERC1967Proxy(address(registry), initData);
        proxy = DIDRegistryForTest(address(proxy1967));
    }

    function _addRegistrar() internal {
        vm.prank(_owner);
        address[] memory addings = new address[](1);
        addings[0] = _registrar;
        proxy.updateRegistrars(addings, new address[](0));
    }

    function _registerDid() internal {
        _addRegistrar();
        vm.prank(_registrar);
        proxy.register(DID_IDENTIFIER_0, _user);
    }

    function _registerDid(uint128 identifier) internal {
        _addRegistrar();
        vm.prank(_registrar);
        proxy.register(identifier, _user);
    }

    function test_initialize_should_pass() public view {
        address owner = proxy.owner();
        vm.assertEq(owner, _owner);
    }

    function test_initialize_should_fail_with_reinitialing() public {
        vm.expectRevert(abi.encodeWithSelector(Initializable.InvalidInitialization.selector));
        proxy.initialize(_owner);
    }

    function test_updateRegistrars_should_fail_with_caller_not_owner() public {
        vm.prank(_user);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, _user));
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
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.NotRegistrar.selector, _owner));
        proxy.register(DID_IDENTIFIER_0, _owner);
    }

    function test_register_should_pass_with_called_by_registrar() public {
        _addRegistrar();

        vm.startPrank(_registrar);
        vm.expectEmit(true, false, false, true);
        emit DIDRegistry.DIDRegistered(DID_IDENTIFIER_0, _user);
        proxy.register(DID_IDENTIFIER_0, _user);

        uint128[] memory identifiers = proxy.getOwnedDids(_user);
        vm.assertEq(identifiers.length, 1);
        vm.assertEq(identifiers[0], DID_IDENTIFIER_0);
    }

    function test_register_should_fail_with_did_exists() public {
        _addRegistrar();

        vm.startPrank(_registrar);
        proxy.register(DID_IDENTIFIER_0, _user);
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.DIDAlreadyRegistered.selector, DID_IDENTIFIER_0, _user));
        proxy.register(DID_IDENTIFIER_0, _user);
    }

    function test_setAttribute_should_revert_with_not_controller() public {
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.NotController.selector, DID_IDENTIFIER_0, DID_IDENTIFIER_0));
        proxy.setAttribute(
            DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION, bytes("")
        );
    }

    function test_setAttribute_should_revert_with_not_system_kv_attribute_name() public {
        _registerDid();
        vm.startPrank(_user);
        string memory illegalName = "illegal_name";
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.NotKvAttribute.selector, illegalName));
        proxy.setAttribute(DID_IDENTIFIER_0, DID_IDENTIFIER_0, illegalName, bytes(""));
    }

    function test_setAttribute_should_pass() public {
        _registerDid();
        vm.startPrank(_user);
        proxy.addKvAttributeNames();
        vm.expectEmit(true, false, false, true);
        emit DIDRegistry.DIDAttributeSet(DID_IDENTIFIER_0, DID_IDENTIFIER_0, KV_ATTRIBUTE_NAME, bytes("kv"));
        proxy.setAttribute(DID_IDENTIFIER_0, DID_IDENTIFIER_0, KV_ATTRIBUTE_NAME, bytes("kv"));

        (,,, IDIDRegistry.KvAttribute[] memory kvAttributes,) = proxy.getDidDocument(DID_IDENTIFIER_0);
        vm.assertEq(kvAttributes.length, 1);
        vm.assertEq(kvAttributes[0].name, KV_ATTRIBUTE_NAME);
        vm.assertEq(kvAttributes[0].value, bytes("kv"));
    }

    function test_revokeAttribute_should_revert_with_not_controller() public {
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.NotController.selector, DID_IDENTIFIER_0, DID_IDENTIFIER_0));
        proxy.revokeAttribute(DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION);
    }

    function test_revokeAttribute_should_revert_with_not_system_kv_attribute_name() public {
        _registerDid();
        vm.startPrank(_user);
        string memory illegalName = "illegal_name";
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.NotKvAttribute.selector, illegalName));
        proxy.revokeAttribute(DID_IDENTIFIER_0, DID_IDENTIFIER_0, illegalName);
    }

    function test_revokeAttribute() public {
        _registerDid();
        vm.startPrank(_user);
        proxy.addKvAttributeNames();
        vm.expectEmit(true, false, false, true);
        emit DIDRegistry.DIDAttributeSet(DID_IDENTIFIER_0, DID_IDENTIFIER_0, KV_ATTRIBUTE_NAME, bytes("kv"));
        proxy.setAttribute(DID_IDENTIFIER_0, DID_IDENTIFIER_0, KV_ATTRIBUTE_NAME, bytes("kv"));

        vm.expectEmit(true, false, false, true);
        emit DIDRegistry.DIDAttributeRevoked(DID_IDENTIFIER_0, DID_IDENTIFIER_0, KV_ATTRIBUTE_NAME, bytes("kv"));
        proxy.revokeAttribute(DID_IDENTIFIER_0, DID_IDENTIFIER_0, KV_ATTRIBUTE_NAME);

        (,,, IDIDRegistry.KvAttribute[] memory kvAttributes,) = proxy.getDidDocument(DID_IDENTIFIER_0);
        vm.assertEq(kvAttributes.length, 1);
        vm.assertEq(kvAttributes[0].name, KV_ATTRIBUTE_NAME);
        vm.assertEq(kvAttributes[0].value, bytes(""));
    }

    function test_addItemToAttribute_should_fail_with_not_controller() public {
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.NotController.selector, DID_IDENTIFIER_0, DID_IDENTIFIER_0));
        proxy.addItemToAttribute(
            DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION, bytes("")
        );
    }

    // function test_addItemToAttribute_should_fail_with_caller_not_owner_of_controller() public {
    //     _registerDid();
    //     vm.startPrank(_user);
    //     vm.expectRevert(
    //         abi.encodeWithSelector(
    //             DIDRegistry.NotOwnerOfController.selector,
    //             DID_IDENTIFIER_0,
    //             DID_IDENTIFIER_0,
    //             _user
    //         )
    //     );
    //     proxy.addItemToAttribute(DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION, bytes(""));
    // }

    function test_addItemToAttribute_should_fail_with_attribute_name_error() public {
        _registerDid();
        vm.startPrank(_user);
        string memory wrongAttributeName = "wrong_name";
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.NotArrayAttribute.selector, wrongAttributeName));
        proxy.addItemToAttribute(DID_IDENTIFIER_0, DID_IDENTIFIER_0, wrongAttributeName, bytes(""));
    }

    function test_addItemToAttribute_should_pass_with_caller_is_owner() public {
        _registerDid();
        vm.startPrank(_user);
        vm.expectEmit(true, false, false, true);
        emit DIDRegistry.DIDAttributeItemAdded(
            DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION, 0, bytes("array")
        );
        proxy.addItemToAttribute(
            DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION, bytes("array")
        );

        (
            uint256 id,
            address owner,
            uint128[] memory controller,,
            IDIDRegistry.ArrayAttribute[] memory arrayAttributes
        ) = proxy.getDidDocument(DID_IDENTIFIER_0);
        vm.assertEq(id, DID_IDENTIFIER_0);
        vm.assertEq(owner, _user);
        vm.assertEq(controller.length, 0);
        for (uint256 i = 0; i < arrayAttributes.length; i++) {
            if (
                keccak256(bytes(arrayAttributes[i].name))
                    == keccak256(bytes(SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION))
            ) {
                vm.assertEq(arrayAttributes[i].values.length, 1);
                vm.assertEq(arrayAttributes[i].values[0].value, bytes("array"));
                vm.assertEq(arrayAttributes[i].values[0].revoked, false);
            }
        }
    }

    function test_revokeItemFromAttribute_should_revert_with_not_controller() public {
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.NotController.selector, DID_IDENTIFIER_0, DID_IDENTIFIER_0));
        proxy.revokeItemFromAttribute(
            DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION, 0
        );
    }

    function test_revokeItemFromAttribute_should_revert_with_not_system_array_attribute_name() public {
        _registerDid();
        vm.startPrank(_user);
        string memory illegalName = "illegal_name";
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.NotArrayAttribute.selector, illegalName));
        proxy.revokeItemFromAttribute(DID_IDENTIFIER_0, DID_IDENTIFIER_0, illegalName, 0);
    }

    function test_revokeItemFromAttribute_should_revert_with_index_not_exist() public {
        _registerDid();
        vm.startPrank(_user);
        vm.expectRevert(
            abi.encodeWithSelector(
                DIDRegistry.AttributeIndexNotExist.selector,
                DID_IDENTIFIER_0,
                SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION,
                10
            )
        );
        proxy.revokeItemFromAttribute(
            DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION, 10
        );
    }

    function test_revokeItemFromAttribute() public {
        _registerDid();
        vm.startPrank(_user);
        vm.expectEmit(true, false, false, true);
        emit DIDRegistry.DIDAttributeItemAdded(
            DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION, 0, bytes("array")
        );
        proxy.addItemToAttribute(
            DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION, bytes("array")
        );

        vm.expectEmit(true, false, false, true);
        emit DIDRegistry.DIDAttributeItemRevoked(
            DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION, 0, bytes("array")
        );
        proxy.revokeItemFromAttribute(
            DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION, 0
        );

        (,,,, IDIDRegistry.ArrayAttribute[] memory arrayAttributes) = proxy.getDidDocument(DID_IDENTIFIER_0);
        for (uint256 i = 0; i < arrayAttributes.length; i++) {
            if (
                keccak256(bytes(arrayAttributes[i].name))
                    == keccak256(bytes(SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION))
            ) {
                vm.assertEq(arrayAttributes[i].values.length, 1);
                vm.assertEq(arrayAttributes[i].values[0].value, bytes("array"));
                vm.assertEq(arrayAttributes[i].values[0].revoked, true);
            }
        }
    }

    function test_setCustomAttribute_should_revert_with_not_controller() public {
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.NotController.selector, DID_IDENTIFIER_0, DID_IDENTIFIER_0));
        proxy.setCustomAttribute(
            DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION, bytes("")
        );
    }

    function test_setCustomAttribute_should_revert_with_system_attribute_name() public {
        _registerDid();
        vm.startPrank(_user);
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.ReservedAttribute.selector, SystemAttribute.RESERVE_ID));
        proxy.setCustomAttribute(DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.RESERVE_ID, bytes(""));

        vm.expectRevert(
            abi.encodeWithSelector(
                DIDRegistry.ReservedAttribute.selector, SystemAttribute.ARRAY_ATTRIBUTE_VERIFICATION_METHOD
            )
        );
        proxy.setCustomAttribute(
            DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_VERIFICATION_METHOD, bytes("")
        );
    }

    function test_setCustomAttribute_should_pass() public {
        string memory customAttributeName = "custom";
        _registerDid();
        vm.startPrank(_user);
        vm.expectEmit(true, false, false, true);
        emit DIDRegistry.DIDAttributeSet(DID_IDENTIFIER_0, DID_IDENTIFIER_0, customAttributeName, bytes("custom"));
        proxy.setCustomAttribute(DID_IDENTIFIER_0, DID_IDENTIFIER_0, customAttributeName, bytes("custom"));

        (,,, IDIDRegistry.KvAttribute[] memory kvAttributes,) = proxy.getDidDocument(DID_IDENTIFIER_0);
        vm.assertEq(kvAttributes.length, 1);
        vm.assertEq(kvAttributes[0].name, customAttributeName);
        vm.assertEq(kvAttributes[0].value, bytes("custom"));
    }

    function test_revokeCustomAttribute_should_revert_with_not_controller() public {
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.NotController.selector, DID_IDENTIFIER_0, DID_IDENTIFIER_0));
        proxy.revokeCustomAttribute(DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION);
    }

    function test_revokeCustomAttribute_should_revert_with_system_attribute_name() public {
        _registerDid();
        vm.startPrank(_user);
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.ReservedAttribute.selector, SystemAttribute.RESERVE_ID));
        proxy.revokeCustomAttribute(DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.RESERVE_ID);

        vm.expectRevert(
            abi.encodeWithSelector(DIDRegistry.ReservedAttribute.selector, SystemAttribute.ARRAY_ATTRIBUTE_SERVICE)
        );
        proxy.revokeCustomAttribute(DID_IDENTIFIER_0, DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_SERVICE);
    }

    function test_revokeCustomAttribute() public {
        string memory customAttributeName = "custom";
        _registerDid();
        vm.startPrank(_user);
        vm.expectEmit(true, false, false, true);
        emit DIDRegistry.DIDAttributeSet(DID_IDENTIFIER_0, DID_IDENTIFIER_0, customAttributeName, bytes("custom"));
        proxy.setCustomAttribute(DID_IDENTIFIER_0, DID_IDENTIFIER_0, customAttributeName, bytes("custom"));

        vm.expectEmit(true, false, false, true);
        emit DIDRegistry.DIDAttributeRevoked(DID_IDENTIFIER_0, DID_IDENTIFIER_0, customAttributeName, bytes("custom"));
        proxy.revokeCustomAttribute(DID_IDENTIFIER_0, DID_IDENTIFIER_0, customAttributeName);

        (,,, IDIDRegistry.KvAttribute[] memory kvAttributes,) = proxy.getDidDocument(DID_IDENTIFIER_0);
        vm.assertEq(kvAttributes.length, 0);
    }

    function test_addController_should_revert_with_not_controller() public {
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.NotController.selector, DID_IDENTIFIER_0, DID_IDENTIFIER_0));
        proxy.addController(DID_IDENTIFIER_0, DID_IDENTIFIER_0, DID_IDENTIFIER_0);
    }

    function test_addController_should_revert_with_controller_not_exist() public {
        _registerDid();
        vm.startPrank(_user);
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.DIDNotExists.selector, DID_IDENTIFIER_1));
        proxy.addController(DID_IDENTIFIER_0, DID_IDENTIFIER_0, DID_IDENTIFIER_1);
    }

    function test_addController() public {
        _registerDid(DID_IDENTIFIER_0);
        _registerDid(DID_IDENTIFIER_1);
        vm.startPrank(_user);
        vm.expectEmit(true, false, false, true);
        emit DIDRegistry.DIDControllerAdded(DID_IDENTIFIER_0, DID_IDENTIFIER_0, DID_IDENTIFIER_1);
        proxy.addController(DID_IDENTIFIER_0, DID_IDENTIFIER_0, DID_IDENTIFIER_1);

        (,, uint128[] memory controller,,) = proxy.getDidDocument(DID_IDENTIFIER_0);
        vm.assertEq(controller.length, 1);

        uint128[] memory cs = proxy.controllersOf(DID_IDENTIFIER_0);
        vm.assertEq(cs.length, 1);
    }

    function test_addController_should_revert_with_controller_duplicated() public {
        _registerDid(DID_IDENTIFIER_0);
        vm.prank(_user);
        vm.expectRevert(
            abi.encodeWithSelector(DIDRegistry.AlreadyIncludedInController.selector, DID_IDENTIFIER_0, DID_IDENTIFIER_0)
        );
        proxy.addController(DID_IDENTIFIER_0, DID_IDENTIFIER_0, DID_IDENTIFIER_0);

        _registerDid(DID_IDENTIFIER_1);
        vm.startPrank(_user);
        vm.expectEmit(true, false, false, true);
        emit DIDRegistry.DIDControllerAdded(DID_IDENTIFIER_0, DID_IDENTIFIER_0, DID_IDENTIFIER_1);
        proxy.addController(DID_IDENTIFIER_0, DID_IDENTIFIER_0, DID_IDENTIFIER_1);
        vm.expectRevert(
            abi.encodeWithSelector(DIDRegistry.AlreadyIncludedInController.selector, DID_IDENTIFIER_0, DID_IDENTIFIER_1)
        );
        proxy.addController(DID_IDENTIFIER_0, DID_IDENTIFIER_0, DID_IDENTIFIER_1);
    }

    function test_revokeController_should_revert_with_not_controller() public {
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.NotController.selector, DID_IDENTIFIER_0, DID_IDENTIFIER_0));
        proxy.revokeController(DID_IDENTIFIER_0, DID_IDENTIFIER_0, DID_IDENTIFIER_0);
    }

    function test_revokeController_should_revert_with_controller_not_found() public {
        _registerDid();
        vm.startPrank(_user);
        vm.expectRevert(
            abi.encodeWithSelector(DIDRegistry.ControllerNotFound.selector, DID_IDENTIFIER_0, DID_IDENTIFIER_1)
        );
        proxy.revokeController(DID_IDENTIFIER_0, DID_IDENTIFIER_0, DID_IDENTIFIER_1);
    }

    function test_revokeController() public {
        _registerDid(DID_IDENTIFIER_0);
        _registerDid(DID_IDENTIFIER_1);
        vm.startPrank(_user);
        vm.expectEmit(true, false, false, true);
        emit DIDRegistry.DIDControllerAdded(DID_IDENTIFIER_0, DID_IDENTIFIER_0, DID_IDENTIFIER_1);
        proxy.addController(DID_IDENTIFIER_0, DID_IDENTIFIER_0, DID_IDENTIFIER_1);

        vm.expectEmit(true, false, false, true);
        emit DIDRegistry.DIDControllerRevoked(DID_IDENTIFIER_0, DID_IDENTIFIER_0, DID_IDENTIFIER_1);
        proxy.revokeController(DID_IDENTIFIER_0, DID_IDENTIFIER_0, DID_IDENTIFIER_1);

        (,, uint128[] memory controller,,) = proxy.getDidDocument(DID_IDENTIFIER_0);
        vm.assertEq(controller.length, 0);
    }

    function test_transferOwner_should_revert_with_caller_not_did_owner() public {
        vm.startPrank(_user);
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.NotDIDOwner.selector, DID_IDENTIFIER_0, _user));
        proxy.transferOwner(DID_IDENTIFIER_0, _user);
    }

    function test_transferOwner() public {
        _registerDid();
        vm.startPrank(_user);
        vm.expectEmit(true, false, false, true);
        emit DIDRegistry.DIDOwnerChanged(DID_IDENTIFIER_0, _user, _owner);
        proxy.transferOwner(DID_IDENTIFIER_0, _owner);

        (, address owner,,,) = proxy.getDidDocument(DID_IDENTIFIER_0);
        vm.assertEq(owner, _owner);

        uint128[] memory dids = proxy.getOwnedDids(_user);
        vm.assertEq(dids.length, 0);
        dids = proxy.getOwnedDids(_owner);
        vm.assertEq(dids.length, 1);
    }

    function test_addAuthentication() public {
        _registerDid();
        vm.startPrank(_user);
        proxy.addAuthentication(DID_IDENTIFIER_0, DID_IDENTIFIER_0, bytes("authentication"));

        (,,,, IDIDRegistry.ArrayAttribute[] memory arrayAttributes) = proxy.getDidDocument(DID_IDENTIFIER_0);
        for (uint256 i = 0; i < arrayAttributes.length; i++) {
            if (
                keccak256(bytes(arrayAttributes[i].name))
                    == keccak256(bytes(SystemAttribute.ARRAY_ATTRIBUTE_VERIFICATION_METHOD))
            ) {
                vm.assertEq(arrayAttributes[i].values.length, 1);
                vm.assertEq(arrayAttributes[i].values[0].value, bytes("authentication"));
                vm.assertEq(arrayAttributes[i].values[0].revoked, false);
            }
        }

        (bool found, uint256 index) = proxy.checkArrayAttribute(
            DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_VERIFICATION_METHOD, bytes("authentication")
        );
        vm.assertEq(found, true);
        vm.assertEq(index, 0);
    }

    function test_revokeAuthentication() public {
        _registerDid();
        vm.startPrank(_user);
        proxy.addAuthentication(DID_IDENTIFIER_0, DID_IDENTIFIER_0, bytes("authentication"));
        proxy.revokeAuthentication(DID_IDENTIFIER_0, DID_IDENTIFIER_0, bytes("authentication"));

        (,,,, IDIDRegistry.ArrayAttribute[] memory arrayAttributes) = proxy.getDidDocument(DID_IDENTIFIER_0);
        for (uint256 i = 0; i < arrayAttributes.length; i++) {
            if (
                keccak256(bytes(arrayAttributes[i].name))
                    == keccak256(bytes(SystemAttribute.ARRAY_ATTRIBUTE_VERIFICATION_METHOD))
            ) {
                vm.assertEq(arrayAttributes[i].values.length, 1);
                vm.assertEq(arrayAttributes[i].values[0].value, bytes("authentication"));
                vm.assertEq(arrayAttributes[i].values[0].revoked, true);
            }
        }

        (bool found, uint256 index) = proxy.checkArrayAttribute(
            DID_IDENTIFIER_0, SystemAttribute.ARRAY_ATTRIBUTE_VERIFICATION_METHOD, bytes("authentication")
        );
        vm.assertEq(found, false);
        vm.assertEq(index, 0);
    }
}
