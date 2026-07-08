// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";
import {HumanbasedRegistrar} from "../src/HumanbasedRegistrar.sol";
import {DIDGenerator} from "../src/lib/DIDGenerator.sol";

contract HumanbasedRegistrarTest is Test {
    DIDRegistry internal proxy;
    HumanbasedRegistrar internal registrar;

    address internal _admin;
    address internal _relayer;
    address internal _platformOwner;
    address internal _stranger;

    string internal constant USER_ID = "user-00000000-0000-0000-0000-000000000001";

    function setUp() public {
        _admin = makeAddr("admin");
        _relayer = makeAddr("relayer");
        _platformOwner = makeAddr("platformOwner");
        _stranger = makeAddr("stranger");

        DIDRegistry impl = new DIDRegistry();
        bytes memory initData = abi.encodeWithSelector(DIDRegistry.initialize.selector, _admin);
        proxy = DIDRegistry(address(new ERC1967Proxy(address(impl), initData)));

        vm.prank(_admin);
        registrar = new HumanbasedRegistrar(address(proxy), _relayer, _platformOwner);

        address[] memory addings = new address[](1);
        addings[0] = address(registrar);
        vm.prank(_admin);
        proxy.updateRegistrars(addings, new address[](0));
    }

    function test_register_happyPath() public {
        uint128 expected = DIDGenerator.deterministicUint128(USER_ID);

        vm.prank(_relayer);
        uint128 identifier = registrar.register(USER_ID);

        assertEq(identifier, expected);
        assertEq(proxy.ownerOf(identifier), _platformOwner);

        uint128[] memory owned = proxy.getOwnedDids(_platformOwner);
        assertEq(owned.length, 1);
        assertEq(owned[0], expected);
    }

    function test_register_nonRelayer_reverts() public {
        vm.prank(_stranger);
        vm.expectRevert(abi.encodeWithSelector(HumanbasedRegistrar.NotRelayer.selector, _stranger));
        registrar.register(USER_ID);
    }

    function test_register_idempotent() public {
        vm.prank(_relayer);
        uint128 first = registrar.register(USER_ID);

        // Re-registering the same user id is a no-op and returns the same identifier.
        vm.prank(_relayer);
        uint128 second = registrar.register(USER_ID);

        assertEq(first, second);
        assertEq(proxy.ownerOf(first), _platformOwner);
        assertEq(proxy.getOwnedDids(_platformOwner).length, 1);
    }

    function test_register_conflictingOwner_reverts() public {
        vm.prank(_relayer);
        uint128 identifier = registrar.register(USER_ID);

        // Point platformOwner at a different address, then re-register the same user id.
        // The identifier is already owned by the old platform owner, so the registry rejects it.
        vm.prank(_admin);
        registrar.setPlatformOwner(_stranger);

        vm.prank(_relayer);
        vm.expectRevert(abi.encodeWithSelector(DIDRegistry.DIDAlreadyRegistered.selector, identifier, _platformOwner));
        registrar.register(USER_ID);
    }

    function test_computeIdentifier_matchesRegistered() public {
        uint128 computed = registrar.computeIdentifier(USER_ID);
        vm.prank(_relayer);
        uint128 registered = registrar.register(USER_ID);
        assertEq(computed, registered);
    }

    function test_setRelayer_onlyOwner() public {
        vm.prank(_stranger);
        vm.expectRevert();
        registrar.setRelayer(_stranger);

        vm.prank(_admin);
        registrar.setRelayer(_stranger);
        assertEq(registrar.relayer(), _stranger);

        vm.prank(_stranger);
        registrar.register("another-user");
    }

    /// @notice The off-chain helper (script/did_identifier.py) and the shared
    ///         reference vectors must be byte-identical to the on-chain derivation.
    function test_referenceVectors_match() public view {
        string memory json = vm.readFile("script/did_identifier_vectors.json");

        assertEq(vm.parseJsonBytes32(json, ".domainSalt"), DIDGenerator.DOMAIN_SALT, "DOMAIN_SALT mismatch");

        uint256 count = vm.parseJsonUint(json, ".count");
        for (uint256 i = 0; i < count; i++) {
            string memory base = string.concat(".vectors[", vm.toString(i), "]");
            string memory userId = vm.parseJsonString(json, string.concat(base, ".userId"));
            uint256 expected = vm.parseJsonUint(json, string.concat(base, ".identifier"));
            assertEq(uint256(DIDGenerator.deterministicUint128(userId)), expected);
        }
    }
}
