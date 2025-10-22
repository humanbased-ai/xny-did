// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {SystemAttribute} from "./lib/SystemAttribute.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

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

contract DIDRegistry {
    // Add the library methods
    using EnumerableMap for EnumerableMap.AddressToUintMap;
    using EnumerableMap for EnumerableMap.UintToUintMap;

    // reserved attributes
    mapping(string => bool) _reservedAttributeNames;
    // kv attributes
    mapping(string => bool) _kvAttributeNames;
    // array attributes
    mapping(string => bool) _arrayAttributeNames;

    // registrar contract address
    EnumerableMap.AddressToUintMap _registrars;
    // did owners
    mapping(uint128 => address) _didOwners;
    // did controllers
    mapping(uint128 => EnumerableMap.UintToUintMap) _didControllers;
    // K-V attributes,
    mapping(uint128 => mapping(string => bytes)) _kvAttributes;
    // array attributes
    mapping(uint128 => mapping(string => ArrayAttributeItem[])) _arrayAttributes;
    // custom attribute keys
    mapping(uint128 => string[]) _customAttributeKeys;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error NotRegistrar(address account);

    /**
     * @dev The caller is not DID owner
     */
    error NotDIDOwner(uint128 identifier, address sender);

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
    event DIDOwnerChanged(uint128 identifier, uint128 oldOwner, address newOwner);

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
        EnumerableMap.UintToUintMap storage controllers = _didControllers[identifier];
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

    constructor() {
        _reservedAttributeNames[SystemAttribute.RESERVE_ID] = true;
        _reservedAttributeNames[SystemAttribute.RESERVE_OWNER] = true;
        _reservedAttributeNames[SystemAttribute.RESERVE_CONTROLLER] = true;

        _arrayAttributeNames[SystemAttribute.ARRAY_ATTRIBUTE_VERIFICATION_METHOD] = true;
        _arrayAttributeNames[SystemAttribute.ARRAY_ATTRIBUTE_ALSO_KNOW_AS] = true;
        _arrayAttributeNames[SystemAttribute.ARRAY_ATTRIBUTE_AUTHENTICATION] = true;
        _arrayAttributeNames[SystemAttribute.ARRAY_ATTRIBUTE_ASSERTION_METHOD] = true;
        _arrayAttributeNames[SystemAttribute.ARRAY_ATTRIBUTE_KEY_AGREEMENT] = true;
        _arrayAttributeNames[SystemAttribute.ARRAY_ATTRIBUTE_CAPABILITY_INVOCATION] = true;
        _arrayAttributeNames[SystemAttribute.ARRAY_ATTRIBUTE_CAPABILITY_DELEGATION] = true;
        _arrayAttributeNames[SystemAttribute.ARRAY_ATTRIBUTE_SERVICE] = true;
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
        if (!_kvAttributeNames[name]) {
            revert NotKvAttribute(name);
        }

        mapping(string => bytes) storage attributes = _kvAttributes[identifier];
        attributes[name] = value;

        emit DIDAttributeSet(identifier, operator, name, value);
    }

    /**
     * @notice Remove an K-V attribute from a DID document
     * @dev Emit the event `DIDAttributeRevoked` if the call succeeds
     * @param identifier the identifier of the DID to be operated
     * @param operator the DID identifier which perform the operation
     * @param name the attribute name to be set
     */
    function revokeAttribute(uint128 identifier, uint128 operator, string calldata name) public onlyDidController(identifier, operator) {
        if (!_kvAttributeNames[name]) {
            revert NotKvAttribute(name);
        }

        mapping(string => bytes) storage attributes = _kvAttributes[identifier];

        emit DIDAttributeRevoked(identifier, operator, name, attributes[name]);

        delete attributes[name];
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
        if (!_arrayAttributeNames[name]) {
            revert NotArrayAttribute(name);
        }

        mapping(string => ArrayAttributeItem[]) storage attributes = _arrayAttributes[identifier];
        attributes[name].push(ArrayAttributeItem(value, false));

        emit DIDAttributeItemAdded(identifier, operator, name, attributes[name].length - 1, value);
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
        if (!_arrayAttributeNames[name]) {
            revert NotArrayAttribute(name);
        }

        mapping(string => ArrayAttributeItem[]) storage attributes = _arrayAttributes[identifier];

        if (index > attributes[name].length - 1) {
            revert AttributeIndexNotExist(identifier, name, index);
        }

        attributes[name][index].revoked = true;

        emit DIDAttributeItemRevoked(identifier, operator, name, index, attributes[name][index].value);
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
    {}

    /**
     * @notice Remove an K-V attribute from a DID document
     * @dev Emit the event `DIDAttributeRevoked` if the call succeeds
     * @param identifier the identifier of the DID to be operated
     * @param operator the DID identifier which perform the operation
     * @param name the attribute name to be set
     */
    function revokeCustomAttribute(uint128 identifier, uint128 operator, string calldata name) public onlyDidController(identifier, operator) {}

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
    function addController(uint128 identifier, uint128 operator, uint128 controller) public onlyDidController(identifier, operator) {}

    /**
     * @notice Remove a controller from the DID document.
     * @dev Emit the event `DIDControllerRevoked` if the call succeeds.
     * @param identifier the identifier of the DID to be operated
     * @param operator the DID identifier which perform the operation
     * @param controller the controller identifier to be revoked
     */
    function revokeController(uint128 identifier, uint128 operator, uint128 controller) public onlyDidController(identifier, operator) {}

    /**
     * @notice Transfer the owner of a DID to a new account.
     * @dev Emit the event `DIDOwnerChanged` if the call succeeds.
     * @param identifier the identifier of the DID to be operated
     * @param to the new owner address
     */
    function transferOwner(uint128 identifier, address to) public onlyDidOwner(identifier) {}

    /**
     * @notice Returns all data of a DID to construct the DID document
     * @param identifier the identifier of the DID to be operated
     * @return id the identifier of the DID Document
     * @return controller the controller identifiers
     * @return kvAttributes K-V attributes
     * @return arrayAttributes
     */
    function getDidDocument(uint128 identifier)
        public
        view
        returns (
            uint128 id,
            uint128[] memory controller,
            KvAttribute[] memory kvAttributes,
            ArrayAttribute[] memory arrayAttributes,
            string[] memory customAttributeNames
        )
    {
        id = identifier;
        controller = new uint128[](0);
        kvAttributes = new KvAttribute[](0);
        arrayAttributes = new ArrayAttribute[](0);
        customAttributeNames = new string[](0);
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
        return address(this);
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
    function getRegistrar() public view returns (address[] memory registrars) {
        registrars = _registrars.keys();
    }

    /**
     * @notice Update registrars
     * @param addings new registrars to add
     * @param removings registrars to remove
     */
    function updateRegistrars(address[] calldata addings, address[] calldata removings) public view returns (address[] memory registrars) {
        registrars = _registrars.keys();
    }
}
