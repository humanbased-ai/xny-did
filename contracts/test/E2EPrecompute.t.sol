// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";
import {HumanbasedRegistrar} from "../src/HumanbasedRegistrar.sol";
import {DIDGenerator} from "../src/lib/DIDGenerator.sol";

/// @title E2EPrecomputeTest
/// @notice End-to-end verification of the deterministic precompute flow:
///         Python off-chain helper  <->  shared reference vectors  <->  on-chain
///         Solidity derivation  <->  HumanbasedRegistrar.register()  <->  DIDRegistry.
///
/// The Python step is invoked through `vm.ffi`, which requires:
///   - `ffi = true` in foundry.toml (set in this repo)
///   - `python3` on PATH with `eth_utils` installed
///     (see contracts/script/requirements.txt). Override with the `PYTHON_BIN`
///     env var to point at a venv interpreter.
contract E2EPrecomputeTest is Test {
    DIDRegistry internal proxy;
    HumanbasedRegistrar internal registrar;

    address internal admin;
    address internal relayer;
    address internal platformOwner;
    address internal stranger;

    string internal constant VECTORS_PATH = "script/did_identifier_vectors.json";
    string internal constant HELPER = "script/did_identifier.py";
    string internal pythonBin;

    function setUp() public {
        admin = makeAddr("admin");
        relayer = makeAddr("relayer");
        platformOwner = makeAddr("platformOwner");
        stranger = makeAddr("stranger");

        try vm.envString("PYTHON_BIN") returns (string memory v) {
            pythonBin = v;
        } catch {
            pythonBin = "python3";
        }

        DIDRegistry impl = new DIDRegistry();
        bytes memory initData = abi.encodeWithSelector(DIDRegistry.initialize.selector, admin);
        proxy = DIDRegistry(address(new ERC1967Proxy(address(impl), initData)));

        vm.prank(admin);
        registrar = new HumanbasedRegistrar(address(proxy), relayer, platformOwner);

        address[] memory addings = new address[](1);
        addings[0] = address(registrar);
        vm.prank(admin);
        proxy.updateRegistrars(addings, new address[](0));
    }

    /// @notice Sanity check: the configured python interpreter exists on PATH and
    ///         can import `eth_utils`. Runs before the E2E test so failures here
    ///         point at env setup (missing dep, wrong interpreter), not at the
    ///         contract under test.
    function test_pythonHelper_sanityCheck() public {
        string[] memory versionArgs = new string[](2);
        versionArgs[0] = pythonBin;
        versionArgs[1] = "--version";
        vm.ffi(versionArgs); // reverts with FFIError if interpreter missing

        string[] memory importArgs = new string[](3);
        importArgs[0] = pythonBin;
        importArgs[1] = "-c";
        importArgs[2] = "import eth_utils";
        vm.ffi(importArgs); // reverts with FFIError if dep missing
    }

    /// @notice For every reference vector: assert the Python helper, the on-chain
    ///         derivation, and the shared vectors JSON all agree byte-for-byte,
    ///         and confirm `register` emits the expected event and records the
    ///         platform-custodial owner.
    function test_e2e_pythonMatchesOnChainMatchesVectors() public {
        string memory json = vm.readFile(VECTORS_PATH);
        uint256 count = vm.parseJsonUint(json, ".count");

        for (uint256 i = 0; i < count; i++) {
            string memory base = string.concat(".vectors[", vm.toString(i), "]");
            string memory userId = vm.parseJsonString(json, string.concat(base, ".userId"));
            uint256 expected = vm.parseJsonUint(json, string.concat(base, ".identifier"));

            // 1. Solidity library derivation vs vectors
            assertEq(
                uint256(DIDGenerator.deterministicUint128(userId)),
                expected,
                string.concat("DIDGenerator mismatch for userId=", userId)
            );

            // 2. on-chain HumanbasedRegistrar.computeIdentifier vs vectors
            assertEq(
                uint256(registrar.computeIdentifier(userId)),
                expected,
                string.concat("on-chain computeIdentifier mismatch for userId=", userId)
            );

            // 3. Off-chain Python helper via vm.ffi (cross-language byte-match)
            uint256 pyIdentifier = _pythonIdentifier(userId);
            assertEq(pyIdentifier, expected, string.concat("python mismatch for userId=", userId));
            assertEq(pyIdentifier, uint256(registrar.computeIdentifier(userId)), "python vs on-chain mismatch");

            // 4. Full register path: relayer submits, identifier matches, owner is platform-custodial,
            //    and the `Registered` event is emitted with the right indexed identifier.
            vm.expectEmit(true, false, false, true, address(registrar));
            emit HumanbasedRegistrar.Registered(uint128(expected), platformOwner);

            vm.prank(relayer);
            uint128 registered = registrar.register(userId);
            assertEq(uint256(registered), expected, string.concat("register mismatch for userId=", userId));
            assertEq(proxy.ownerOf(registered), platformOwner, "owner is not platformOwner");
        }
    }

    /// @notice Re-registering the same user id (across vectors) is idempotent
    ///         and the registry tracks exactly one DID per user.
    function test_e2e_registerIdempotentAcrossVectors() public {
        string memory json = vm.readFile(VECTORS_PATH);
        uint256 count = vm.parseJsonUint(json, ".count");
        require(count > 0, "no vectors");

        // Use the first vector as the target; verify register-twice is a no-op.
        string memory first = vm.parseJsonString(json, ".vectors[0].userId");
        uint256 firstExpected = vm.parseJsonUint(json, ".vectors[0].identifier");

        vm.prank(relayer);
        uint128 first1 = registrar.register(first);
        vm.prank(relayer);
        uint128 first2 = registrar.register(first);
        assertEq(uint256(first1), firstExpected);
        assertEq(first2, first1);
        assertEq(proxy.getOwnedDids(platformOwner).length, 1);

        // Register all other vectors; each adds a new DID for the same platform owner.
        for (uint256 i = 1; i < count; i++) {
            string memory userId = vm.parseJsonString(json, string.concat(".vectors[", vm.toString(i), "].userId"));
            vm.prank(relayer);
            registrar.register(userId);
        }
        assertEq(proxy.getOwnedDids(platformOwner).length, count);
    }

    /// @notice The non-relayer path is rejected at the E2E level. The contract's
    ///         unit tests already cover this; this assertion makes the E2E
    ///         coverage claim ("full register path") honest.
    function test_e2e_nonRelayer_reverts() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(HumanbasedRegistrar.NotRelayer.selector, stranger));
        registrar.register("any-user");
    }

    // --- helpers ---

    function _pythonIdentifier(string memory userId) internal returns (uint256) {
        string[] memory args = new string[](4);
        args[0] = pythonBin;
        args[1] = HELPER;
        args[2] = "--user-id";
        args[3] = userId;
        bytes memory stdout = vm.ffi(args);
        return _parseHexLine(string(stdout));
    }

    /// @dev The helper emits one line per field. The line that starts with `hex`
    ///      (case-insensitive) carries the 32-byte hex identifier. We scan
    ///      line-by-line so a stray `0x` substring inside the echoed `user_id`
    ///      line cannot be mis-parsed as the identifier.
    function _parseHexLine(string memory stdout) internal pure returns (uint256 v) {
        bytes memory b = bytes(stdout);
        uint256 lineStart;
        while (lineStart < b.length) {
            uint256 lineEnd = lineStart;
            while (
                lineEnd < b.length && b[lineEnd] != 0x0A /*'\n'*/
            ) {
                lineEnd++;
            }

            if (_startsWithHexLabel(b, lineStart, lineEnd)) {
                uint256 hexToken;
                bool found0x;
                for (uint256 j = lineStart; j + 1 < lineEnd; j++) {
                    if (
                        b[j] == 0x30 /*'0'*/ && b[j + 1] == 0x78 /*'x'*/
                    ) {
                        hexToken = j + 2;
                        found0x = true;
                        break;
                    }
                }
                require(found0x, "hex line missing 0x prefix in python output");
                require(lineEnd - hexToken == 32, "python hex identifier must be 16 bytes (32 hex chars)");

                for (uint256 k = 0; k < 32; k++) {
                    uint8 c = uint8(b[hexToken + k]);
                    uint8 d;
                    if (c >= 0x30 && c <= 0x39) d = c - 0x30; // '0'..'9'
                    else if (c >= 0x61 && c <= 0x66) d = c - 0x61 + 10; // 'a'..'f'
                    else if (c >= 0x41 && c <= 0x46) d = c - 0x41 + 10; // 'A'..'F'
                    else revert("non-hex char in python identifier");
                    v = (v << 4) | d;
                }
                return v;
            }

            // Skip the newline (if any); guard against the trailing-line case.
            lineStart = lineEnd < b.length ? lineEnd + 1 : lineEnd;
        }
        revert("no 'hex' line found in python stdout");
    }

    function _startsWithHexLabel(bytes memory b, uint256 start, uint256 end) private pure returns (bool) {
        // Need at least "hex" (3 bytes) and the next char must be a label separator
        // (space / tab) so we don't match e.g. "hexagon: 0x..." in some other output.
        if (end - start < 4) return false;
        bytes1 a = b[start];
        bytes1 c = b[start + 1];
        bytes1 d = b[start + 2];
        bytes1 sep = b[start + 3];
        bool isHex = (a == 0x68 /*'h'*/
                || a == 0x48 /*'H'*/
            )
            && (c == 0x65 /*'e'*/
                || c == 0x45 /*'E'*/
            )
            && (d == 0x78 /*'x'*/
                || d == 0x58 /*'X'*/
            );
        bool isSep = sep == 0x20 /*' '*/ || sep == 0x09; /*'\t'*/
        return isHex && isSep;
    }
}
