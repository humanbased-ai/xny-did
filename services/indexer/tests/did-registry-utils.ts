import { newMockEvent } from 'matchstick-as';
import { ethereum, BigInt, Bytes, Address } from '@graphprotocol/graph-ts';
import {
  DIDAttributeItemAdded,
  DIDAttributeItemRevoked,
  DIDAttributeRevoked,
  DIDAttributeSet,
  DIDControllerAdded,
  DIDControllerRevoked,
  DIDOwnerChanged,
  DIDRegistered,
  Initialized,
  OwnershipTransferred,
  Upgraded,
} from '../generated/DIDRegistry/DIDRegistry';

export function createDIDAttributeItemAddedEvent(
  identifier: BigInt,
  operator: BigInt,
  name: string,
  index: BigInt,
  value: Bytes,
): DIDAttributeItemAdded {
  let didAttributeItemAddedEvent = changetype<DIDAttributeItemAdded>(newMockEvent());

  didAttributeItemAddedEvent.parameters = new Array();

  didAttributeItemAddedEvent.parameters.push(
    new ethereum.EventParam('identifier', ethereum.Value.fromUnsignedBigInt(identifier)),
  );
  didAttributeItemAddedEvent.parameters.push(
    new ethereum.EventParam('operator', ethereum.Value.fromUnsignedBigInt(operator)),
  );
  didAttributeItemAddedEvent.parameters.push(
    new ethereum.EventParam('name', ethereum.Value.fromString(name)),
  );
  didAttributeItemAddedEvent.parameters.push(
    new ethereum.EventParam('index', ethereum.Value.fromUnsignedBigInt(index)),
  );
  didAttributeItemAddedEvent.parameters.push(
    new ethereum.EventParam('value', ethereum.Value.fromBytes(value)),
  );

  return didAttributeItemAddedEvent;
}

export function createDIDAttributeItemRevokedEvent(
  identifier: BigInt,
  operator: BigInt,
  name: string,
  index: BigInt,
  value: Bytes,
): DIDAttributeItemRevoked {
  let didAttributeItemRevokedEvent = changetype<DIDAttributeItemRevoked>(newMockEvent());

  didAttributeItemRevokedEvent.parameters = new Array();

  didAttributeItemRevokedEvent.parameters.push(
    new ethereum.EventParam('identifier', ethereum.Value.fromUnsignedBigInt(identifier)),
  );
  didAttributeItemRevokedEvent.parameters.push(
    new ethereum.EventParam('operator', ethereum.Value.fromUnsignedBigInt(operator)),
  );
  didAttributeItemRevokedEvent.parameters.push(
    new ethereum.EventParam('name', ethereum.Value.fromString(name)),
  );
  didAttributeItemRevokedEvent.parameters.push(
    new ethereum.EventParam('index', ethereum.Value.fromUnsignedBigInt(index)),
  );
  didAttributeItemRevokedEvent.parameters.push(
    new ethereum.EventParam('value', ethereum.Value.fromBytes(value)),
  );

  return didAttributeItemRevokedEvent;
}

export function createDIDAttributeRevokedEvent(
  identifier: BigInt,
  operator: BigInt,
  name: string,
  value: Bytes,
): DIDAttributeRevoked {
  let didAttributeRevokedEvent = changetype<DIDAttributeRevoked>(newMockEvent());

  didAttributeRevokedEvent.parameters = new Array();

  didAttributeRevokedEvent.parameters.push(
    new ethereum.EventParam('identifier', ethereum.Value.fromUnsignedBigInt(identifier)),
  );
  didAttributeRevokedEvent.parameters.push(
    new ethereum.EventParam('operator', ethereum.Value.fromUnsignedBigInt(operator)),
  );
  didAttributeRevokedEvent.parameters.push(
    new ethereum.EventParam('name', ethereum.Value.fromString(name)),
  );
  didAttributeRevokedEvent.parameters.push(
    new ethereum.EventParam('value', ethereum.Value.fromBytes(value)),
  );

  return didAttributeRevokedEvent;
}

export function createDIDAttributeSetEvent(
  identifier: BigInt,
  operator: BigInt,
  name: string,
  value: Bytes,
): DIDAttributeSet {
  let didAttributeSetEvent = changetype<DIDAttributeSet>(newMockEvent());

  didAttributeSetEvent.parameters = new Array();

  didAttributeSetEvent.parameters.push(
    new ethereum.EventParam('identifier', ethereum.Value.fromUnsignedBigInt(identifier)),
  );
  didAttributeSetEvent.parameters.push(
    new ethereum.EventParam('operator', ethereum.Value.fromUnsignedBigInt(operator)),
  );
  didAttributeSetEvent.parameters.push(
    new ethereum.EventParam('name', ethereum.Value.fromString(name)),
  );
  didAttributeSetEvent.parameters.push(
    new ethereum.EventParam('value', ethereum.Value.fromBytes(value)),
  );

  return didAttributeSetEvent;
}

export function createDIDControllerAddedEvent(
  identifier: BigInt,
  operator: BigInt,
  controller: BigInt,
): DIDControllerAdded {
  let didControllerAddedEvent = changetype<DIDControllerAdded>(newMockEvent());

  didControllerAddedEvent.parameters = new Array();

  didControllerAddedEvent.parameters.push(
    new ethereum.EventParam('identifier', ethereum.Value.fromUnsignedBigInt(identifier)),
  );
  didControllerAddedEvent.parameters.push(
    new ethereum.EventParam('operator', ethereum.Value.fromUnsignedBigInt(operator)),
  );
  didControllerAddedEvent.parameters.push(
    new ethereum.EventParam('controller', ethereum.Value.fromUnsignedBigInt(controller)),
  );

  return didControllerAddedEvent;
}

export function createDIDControllerRevokedEvent(
  identifier: BigInt,
  operator: BigInt,
  controller: BigInt,
): DIDControllerRevoked {
  let didControllerRevokedEvent = changetype<DIDControllerRevoked>(newMockEvent());

  didControllerRevokedEvent.parameters = new Array();

  didControllerRevokedEvent.parameters.push(
    new ethereum.EventParam('identifier', ethereum.Value.fromUnsignedBigInt(identifier)),
  );
  didControllerRevokedEvent.parameters.push(
    new ethereum.EventParam('operator', ethereum.Value.fromUnsignedBigInt(operator)),
  );
  didControllerRevokedEvent.parameters.push(
    new ethereum.EventParam('controller', ethereum.Value.fromUnsignedBigInt(controller)),
  );

  return didControllerRevokedEvent;
}

export function createDIDOwnerChangedEvent(
  identifier: BigInt,
  oldOwner: Address,
  newOwner: Address,
): DIDOwnerChanged {
  let didOwnerChangedEvent = changetype<DIDOwnerChanged>(newMockEvent());

  didOwnerChangedEvent.parameters = new Array();

  didOwnerChangedEvent.parameters.push(
    new ethereum.EventParam('identifier', ethereum.Value.fromUnsignedBigInt(identifier)),
  );
  didOwnerChangedEvent.parameters.push(
    new ethereum.EventParam('oldOwner', ethereum.Value.fromAddress(oldOwner)),
  );
  didOwnerChangedEvent.parameters.push(
    new ethereum.EventParam('newOwner', ethereum.Value.fromAddress(newOwner)),
  );

  return didOwnerChangedEvent;
}

export function createDIDRegisteredEvent(identifier: BigInt, owner: Address): DIDRegistered {
  let didRegisteredEvent = changetype<DIDRegistered>(newMockEvent());

  didRegisteredEvent.parameters = new Array();

  didRegisteredEvent.parameters.push(
    new ethereum.EventParam('identifier', ethereum.Value.fromUnsignedBigInt(identifier)),
  );
  didRegisteredEvent.parameters.push(
    new ethereum.EventParam('owner', ethereum.Value.fromAddress(owner)),
  );

  return didRegisteredEvent;
}

export function createInitializedEvent(version: BigInt): Initialized {
  let initializedEvent = changetype<Initialized>(newMockEvent());

  initializedEvent.parameters = new Array();

  initializedEvent.parameters.push(
    new ethereum.EventParam('version', ethereum.Value.fromUnsignedBigInt(version)),
  );

  return initializedEvent;
}

export function createOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address,
): OwnershipTransferred {
  let ownershipTransferredEvent = changetype<OwnershipTransferred>(newMockEvent());

  ownershipTransferredEvent.parameters = new Array();

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam('previousOwner', ethereum.Value.fromAddress(previousOwner)),
  );
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam('newOwner', ethereum.Value.fromAddress(newOwner)),
  );

  return ownershipTransferredEvent;
}

export function createUpgradedEvent(implementation: Address): Upgraded {
  let upgradedEvent = changetype<Upgraded>(newMockEvent());

  upgradedEvent.parameters = new Array();

  upgradedEvent.parameters.push(
    new ethereum.EventParam('implementation', ethereum.Value.fromAddress(implementation)),
  );

  return upgradedEvent;
}
