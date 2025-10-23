// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {SystemAttribute} from "./lib/SystemAttribute.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

struct KvAttribute {
    string name;
    bytes value;
}

struct ArrayAttribute {
    string name;
    ArrayAttributeItem[] values;
}

struct ArrayAttributeItem {
    bytes value;
    bool revoked;
}

contract DIDRegistry is UUPSUpgradeable, OwnableUpgradeable {
    // Add the library methods
    using EnumerableSet for EnumerableSet.StringSet;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    // reserved attributes
    EnumerableSet.StringSet _otherReservedAttributeNames;
    // kv attributes
    EnumerableSet.StringSet _kvAttributeNames;
    // array attributes
    EnumerableSet.StringSet _arrayAttributeNames;

    // registrar contract address
    EnumerableSet.AddressSet _registrars;
    // did owners
    mapping(uint128 => address) _didOwners;
    // dids owned by a user
    mapping(address => uint128[]) _ownedDids;
    // did controllers
    mapping(uint128 => EnumerableSet.UintSet) _didControllers;
    // K-V attributes,
    mapping(uint128 => mapping(string => bytes)) _kvAttributes;
    // array attributes
    mapping(uint128 => mapping(string => ArrayAttributeItem[])) _arrayAttributes;
    // custom attribute keys
    mapping(uint128 => EnumerableSet.StringSet) _customAttributeKeys;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error NotRegistrar(address account);

    /**
     * @dev The caller is not DID owner
     */
    error NotDIDOwner(uint128 identifier, address sender);

    /**
     * @dev The did identifier has been included in controller
     */
    error AlreadyIncludedInController(uint128 identifier, uint128 controller);

    /**
     * @dev The DID identifer has been registered
     */
    error DIDAlreadyRegistered(uint128 identifier, address owner);

    /**
     * @dev The operator is not controller
     */
    error NotController(uint128 identifier, uint128 controller);

    /**
     * @dev The caller is not the owner of the specified controller
     */
    error NotOwnerOfController(uint128 identifier, uint128 controller, address sender);

    /**
     * @dev Users can not modify reserved attributes
     */
    error ReservedAttribute(string name);

    /**
     * @dev The attribute should be a K-V attribute
     */
    error NotKvAttribute(string name);

    /**
     * @dev The attribute should be an array-type attribute
     */
    error NotArrayAttribute(string name);

    /**
     * @dev The specified index does not exist in the array-type attribute
     */
    error AttributeIndexNotExist(uint128 identifier, string name, uint256 index);

    /**
     * @dev The controller has been added
     */
    error DuplicateController(uint128 identifier, uint128 controller, address sender);

    /**
     * @dev The controller is not found
     */
    error ControllerNotFound(uint128 identifier, uint128 controller);

    /**
     * @dev Emitted when a DID is registered.
     * @param identifier the identifier of the new DID
     * @param owner the owner address of the new DID
     */
    event DIDRegistered(uint128 identifier, address owner);

    /**
     * @dev Emitted when a K-V Attribute is set.
     * @param identifier the identifier of the DID
     * @param operator the operator who set the attribute
     * @param name the attribute name
     * @param value the attribute value
     */
    event DIDAttributeSet(uint128 identifier, uint128 operator, string name, bytes value);

    /**
     * @dev Emitted when a K-V Attribute is removed.
     * @param identifier the identifier of the DID
     * @param operator the operator who set the attribute
     * @param name the attribute name
     * @param value the attribute value
     */
    event DIDAttributeRevoked(uint128 identifier, uint128 operator, string name, bytes value);

    /**
     * @dev Emitted when a child Attribute is pushed to an array-type attribute.
     * @param identifier the identifier of the DID
     * @param operator the operator who set the attribute
     * @param name the attribute name
     * @param index the index of the added item in the array-type attribute
     * @param value the attribute value
     */
    event DIDAttributeItemAdded(uint128 identifier, uint128 operator, string name, uint256 index, bytes value);

    /**
     * @dev Emitted when a child Attribute is removed from an array-type attribute.
     * @param identifier the identifier of the DID
     * @param operator the operator who set the attribute
     * @param name the attribute name
     * @param index the index of the added item in the array-type attribute
     * @param value the attribute value
     */
    event DIDAttributeItemRevoked(uint128 identifier, uint128 operator, string name, uint256 index, bytes value);

    /**
     * @dev Emitted when a controller is added to the did document.
     * @param identifier the identifier of the DID
     * @param operator the operator who set the attribute
     * @param controller the identifier of the new controller
     */
    event DIDControllerAdded(uint128 identifier, uint128 operator, uint128 controller);

    /**
     * @dev Emitted when a controller is remove from the did document.
     * @param identifier the identifier of the DID
     * @param operator the operator who set the attribute
     * @param controller the identifier of the new controller
     */
    event DIDControllerRevoked(uint128 identifier, uint128 operator, uint128 controller);

    /**
     * @dev Emitted when the owner is transferred.
     * @param identifier the identifier of DID
     * @param oldOwner the address of the old owner
     * @param newOwner the address of the new owner
     */
    event DIDOwnerChanged(uint128 identifier, address oldOwner, address newOwner);

    /**
     * @dev Throws if called by any account other than the registrar.
     */
    modifier onlyRegistrar() {
        if (!_registrars.contains(msg.sender)) {
            revert NotRegistrar(msg.sender);
        }
        _;
    }

    /**
     * @dev Throws if not called by a controller.
     */
    modifier onlyDidController(uint128 identifier, uint128 controller) {
        EnumerableSet.UintSet storage controllers = _didControllers[identifier];
        if (!controllers.contains(controller)) {
            revert NotController(identifier, controller);
        }

        if (_didOwners[controller] != msg.sender) {
            revert NotOwnerOfController(identifier, controller, msg.sender);
        }
        _;
    }

    /**
     * @dev Throws if not called by a controller.
     */
    modifier onlyDidOwner(uint128 identifier) {
        if (msg.sender != _didOwners[identifier]) {
            revert NotDIDOwner(identifier, msg.sender);
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    function initialize(address owner) public initializer {
        __Ownable_init(owner);
        __UUPSUpgradeable_init();

        _otherReservedAttributeNames.add(SystemAttribute.RESERVE_ID);
        _otherReservedAttributeNames.add(SystemAttribute.RESERVE_OWNER);
        _otherReservedAttributeNames.add(SystemAttribute.RESERVE_CONTROLLER);

        _arrayAttributeNames.add(SystemAttribute.ARRAY_ATTRIBUTE_VERIFICATION_METHOD);
        _arrayAttributeNames.add(SystemAttribute.ARRAY_ATTRIBUTE_ALSO_KNOW_AS);
        _arrayAttributeNames.add(SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION);
        _arrayAttributeNames.add(SystemAttribute.ARRAY_ATTRIBUTE_ASSERTION_METHOD);
        _arrayAttributeNames.add(SystemAttribute.ARRAY_ATTRIBUTE_KEY_AGREEMENT);
        _arrayAttributeNames.add(SystemAttribute.ARRAY_ATTRIBUTE_CAPABILITY_INVOCATION);
        _arrayAttributeNames.add(SystemAttribute.ARRAY_ATTRIBUTE_CAPABILITY_DELEGATION);
        _arrayAttributeNames.add(SystemAttribute.ARRAY_ATTRIBUTE_SERVICE);
    }

    /**
     * @notice Register a DID
     * @dev Emit the event `DIDRegistered` if the call succeeds
     * @param identifier the identifier of the DID to be registered
     * @param owner the owner address of the DID to be registered
     */
    function register(uint128 identifier, address owner) external onlyRegistrar {
        if (_didOwners[identifier] != address(0)) {
            revert DIDAlreadyRegistered(identifier, _didOwners[identifier]);
        }

        _didOwners[identifier] = owner;
        _ownedDids[owner].push(identifier);

        emit DIDRegistered(identifier, owner);
    }

    /**
     * @notice Set an K-V attribute to a DID document
     * @dev Emit the event `DIDAttributeSet` if the call succeeds
     * @param identifier the identifier of the DID to be operated
     * @param operator the DID identifier which perform the operation
     * @param name the attribute name to be set
     * @param value the attribute value
     */
    function setAttribute(uint128 identifier, uint128 operator, string calldata name, bytes calldata value)
        public
        onlyDidController(identifier, operator)
    {
    }

    /**
     * @notice Remove an K-V attribute from a DID document
     * @dev Emit the event `DIDAttributeRevoked` if the call succeeds
     * @param identifier the identifier of the DID to be operated
     * @param operator the DID identifier which perform the operation
     * @param name the attribute name to be set
     */
    function revokeAttribute(uint128 identifier, uint128 operator, string calldata name) public onlyDidController(identifier, operator) {
    }

    /**
     * @notice Add a child attribute to a array-type attribute of the DID document
     * @dev Emit the event `DIDAttributeItemAdded` if the call succeeds
     * @param identifier the identifier of the DID to be operated
     * @param operator the DID identifier which perform the operation
     * @param name the attribute name
     * @param value the attribute value
     */
    function addItemToAttribute(uint128 identifier, uint128 operator, string calldata name, bytes calldata value)
        public
        onlyDidController(identifier, operator)
    {
    }

    /**
     * @notice Remove a child attribute from a array-type attribute of the DID document
     * @dev Emit the event `DIDAttributeItemRevoked` if the call succeeds
     * @param identifier the identifier of the DID to be operated
     * @param operator the DID identifier which perform the operation
     * @param name the attribute name
     * @param index the index of the attribute in the parent attribute
     */
    function revokeItemFromAttribute(uint128 identifier, uint128 operator, string calldata name, uint256 index)
        public
        onlyDidController(identifier, operator)
    {
    }

    /**
     * @notice Set a custom K-V attribute to a DID document.
     * @dev Emit the event `DIDAttributeSet` if the call succeeds
     * @param identifier the identifier of the DID to be operated
     * @param operator the DID identifier which perform the operation
     * @param name the attribute name to be set
     * @param value the attribute value
     */
    function setCustomAttribute(uint128 identifier, uint128 operator, string calldata name, bytes calldata value)
        public
        onlyDidController(identifier, operator)
    {
    }

    /**
     * @notice Remove a custom K-V attribute from a DID document
     * @dev Emit the event `DIDAttributeRevoked` if the call succeeds
     * @param identifier the identifier of the DID to be operated
     * @param operator the DID identifier which perform the operation
     * @param name the attribute name to be set
     */
    function revokeCustomAttribute(uint128 identifier, uint128 operator, string calldata name) public onlyDidController(identifier, operator) {
    }

    /**
     * @notice Add a controller to the DID document.
     *  The controller has the authority to manage the DID Document.
     *  It is NOT NEEDED to add the own DID identifer to the controlers, the owner has all authority by default.
     * @dev Emit the event `DIDControllerAdded` if the call succeeds
     *  DID resolvers MUST include the own DID identifier in the controller as the first item.
     * @param identifier the identifier of the DID to be operated
     * @param operator the DID identifier which perform the operation
     * @param controller the new controller identifier
     */
    function addController(uint128 identifier, uint128 operator, uint128 controller) public onlyDidController(identifier, operator) {
    }

    /**
     * @notice Remove a controller from the DID document.
     * @dev Emit the event `DIDControllerRevoked` if the call succeeds.
     * @param identifier the identifier of the DID to be operated
     * @param operator the DID identifier which perform the operation
     * @param controller the controller identifier to be revoked
     */
    function revokeController(uint128 identifier, uint128 operator, uint128 controller) public onlyDidController(identifier, operator) {
    }

    /**
     * @notice Transfer the owner of a DID to a new account.
     * @dev Emit the event `DIDOwnerChanged` if the call succeeds.
     * @param identifier the identifier of the DID to be operated
     * @param to the new owner address
     */
    function transferOwner(uint128 identifier, address to) public onlyDidOwner(identifier) {
    }

    /**
     * @notice Returns all data of a DID to construct the DID document
     * @param identifier the identifier of the DID to be operated
     * @return id the identifier of the DID Document
     * @return owner the owner address
     * @return controller the controller identifiers
     * @return kvAttributes K-V attributes
     * @return arrayAttributes
     */
    function getDidDocument(uint128 identifier)
        public
        view
        returns (
            uint128 id,
            address owner,
            uint128[] memory controller,
            KvAttribute[] memory kvAttributes,
            ArrayAttribute[] memory arrayAttributes
        )
    {
        // identifier
        id = identifier;
        // owner
        owner = _didOwners[identifier];
        // controller
        uint256[] memory controllerValues = _didControllers[identifier].values();
        controller = new uint128[](controllerValues.length);
        for (uint256 i = 0; i < controllerValues.length; i++) {
            controller[i] = uint128(controllerValues[i]);
        }
        // kv attribute
        kvAttributes = new KvAttribute[](_kvAttributeNames.length());
        // array attribute
        arrayAttributes = new ArrayAttribute[](_arrayAttributeNames.length());
        for (uint256 i = 0; i < _arrayAttributeNames.length(); i++) {
            string memory attributeName = _arrayAttributeNames.at(i);
            ArrayAttributeItem[] memory attributeItems = new ArrayAttributeItem[](_arrayAttributes[identifier][attributeName].length);
            for (uint256 j = 0; j < _arrayAttributes[identifier][attributeName].length; j++) {
                attributeItems[j] = _arrayAttributes[identifier][attributeName][j];
            }
            arrayAttributes[i] = ArrayAttribute(attributeName, attributeItems);
        }
    }

    /**
     * @notice Returns all did identifiers owned by an account
     * @param account the account to be queryed
     * @return identifiers all did identifiers owner by `account`
     */
    function getOwnedDids(address account) public view returns (uint128[] memory identifiers) {
        identifiers = new uint128[](0);
    }

    /**
     * @notice Returns the owner of a DID identifier
     * @param identifier the DID identifier to be queryed
     * @return owner the owner of `identifier`
     */
    function ownerOf(uint128 identifier) public view returns (address owner) {
        owner = _didOwners[identifier];
    }

    /**
     * @notice Returns dids owned by a user
     * @param account the account to be queryed
     * @return identifiers the did identifiers owned by `account`
     */
    function ownedDids(address account) public view returns (uint128[] memory identifiers) {
        return _ownedDids[account];
    }

    /**
     * @notice Returns controllers of a DID
     * @param identifier the DID identifier to be queryed
     * @return controllers controllers of a DID
     */
    function controllersOf(uint128 identifier) public view returns (uint128[] memory controllers) {
        controllers = new uint128[](0);
    }

    /**
     * @notice Returns the registrar address
     * @return registrars the registrar contract address
     */
    function getRegistrars() public view returns (address[] memory registrars) {
        registrars = _registrars.values();
    }

    /**
     * @notice Update registrars
     * @param addings new registrars to add
     * @param removings registrars to remove
     */
    function updateRegistrars(address[] calldata addings, address[] calldata removings) public onlyOwner {
        for (uint256 i = 0; i < addings.length; i++) {
            _registrars.add(addings[i]);
        }

        for (uint256 i = 0; i < removings.length; i++) {
            _registrars.remove(removings[i]);
        }
    }
}
