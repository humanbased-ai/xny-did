// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {IDIDRegistry} from "./IDIDRegistry.sol";
import {DIDGenerator} from "./lib/DIDGenerator.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title HumanbasedRegistrar
 * @notice Relayer-only registrar for precomputed, deterministic `did:xny` identifiers.
 *
 * The identifier is derived deterministically from an off-chain user id
 * (`DIDGenerator.deterministicUint128`), so it can be precomputed before the
 * user holds any wallet. A backend relayer submits the registration; the DID is
 * assigned to a platform-custodial owner address. Ownership migration to the
 * user's own wallet (claim) is a separate, later flow.
 *
 * Access model:
 *   - `owner` (Ownable): platform admin. Rotates the relayer and platform owner.
 *   - `relayer`: the only account allowed to call `register`. Because
 *     `deterministicUint128(userId)` is public, gating registration to the
 *     relayer prevents third parties from front-running a user's identifier.
 */
contract HumanbasedRegistrar is Ownable {
    IDIDRegistry public registry;
    // Backend relayer; the only account allowed to register.
    address public relayer;
    // Platform-custodial address recorded as the DID owner at registration.
    address public platformOwner;

    error NotRelayer(address account);
    error ZeroAddress();

    // Note: userId is intentionally NOT emitted. It is off-chain data; publishing it
    // on-chain would defeat keeping it off-chain and enable correlation of DIDs to users.
    event Registered(uint128 indexed identifier, address owner);
    event RelayerUpdated(address oldRelayer, address newRelayer);
    event PlatformOwnerUpdated(address oldOwner, address newOwner);

    modifier onlyRelayer() {
        _onlyRelayer();
        _;
    }

    function _onlyRelayer() internal view {
        if (msg.sender != relayer) {
            revert NotRelayer(msg.sender);
        }
    }

    constructor(address _registry, address _relayer, address _platformOwner) Ownable(msg.sender) {
        if (_registry == address(0) || _relayer == address(0) || _platformOwner == address(0)) {
            revert ZeroAddress();
        }
        registry = IDIDRegistry(_registry);
        relayer = _relayer;
        platformOwner = _platformOwner;
    }

    /**
     * @notice Register the deterministic DID for an off-chain user id.
     * @dev Idempotent: if the identifier is already owned by `platformOwner`, this is
     *      a no-op and returns the identifier. If it is owned by a different address,
     *      the underlying registry reverts (`DIDAlreadyRegistered`), surfacing the conflict.
     * @param userId the off-chain user identifier
     * @return identifier the derived 128-bit identifier
     */
    function register(string calldata userId) external onlyRelayer returns (uint128 identifier) {
        identifier = DIDGenerator.deterministicUint128(userId);

        if (registry.ownerOf(identifier) == platformOwner) {
            return identifier;
        }

        registry.register(identifier, platformOwner);
        emit Registered(identifier, platformOwner);
    }

    /// @notice Compute the deterministic identifier for a user id without registering.
    function computeIdentifier(string calldata userId) external pure returns (uint128) {
        return DIDGenerator.deterministicUint128(userId);
    }

    /// @notice Rotate the relayer address.
    function setRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) {
            revert ZeroAddress();
        }
        emit RelayerUpdated(relayer, newRelayer);
        relayer = newRelayer;
    }

    /// @notice Update the platform-custodial owner address used for new registrations.
    function setPlatformOwner(address newPlatformOwner) external onlyOwner {
        if (newPlatformOwner == address(0)) {
            revert ZeroAddress();
        }
        emit PlatformOwnerUpdated(platformOwner, newPlatformOwner);
        platformOwner = newPlatformOwner;
    }
}
