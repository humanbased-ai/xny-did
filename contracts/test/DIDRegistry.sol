// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {DIDRegistry} from "../src/DIDRegistry.sol";

contract DIDRegistryTest is Test {
    DIDRegistry public registry;

    function setUp() public {
        registry = new DIDRegistry();
        // registry.setNumber(0);
    }

    // function test_Increment() public {
    //     counter.increment();
    //     assertEq(counter.number(), 1);
    // }

    // function testFuzz_SetNumber(uint256 x) public {
    //     counter.setNumber(x);
    //     assertEq(counter.number(), x);
    // }
}
