import {
  DIDAttributeItemAdded as DIDAttributeItemAddedEvent,
  DIDAttributeItemRevoked as DIDAttributeItemRevokedEvent,
  DIDAttributeRevoked as DIDAttributeRevokedEvent,
  DIDAttributeSet as DIDAttributeSetEvent,
  DIDControllerAdded as DIDControllerAddedEvent,
  DIDControllerRevoked as DIDControllerRevokedEvent,
  DIDOwnerChanged as DIDOwnerChangedEvent,
  DIDRegistered as DIDRegisteredEvent,
  Initialized as InitializedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  Upgraded as UpgradedEvent
} from "../generated/DIDRegistry/DIDRegistry"
import {
  DIDDocument,
  SingleMethod,
  VerificationMethod,
  Authentication,
  AssertionMethod,
  KeyAgreement,
  CapabilityInvocation,
  CapabilityDelegation,
  Service
} from "../generated/schema"
import { uint128ToUUID, uint128ToDID } from "./utils"
import * as constants from "./constants"
import { log } from "@graphprotocol/graph-ts"
import {ArrayAttributeHandler} from "./arrayAttributeHandler"

export function handleDIDAttributeItemAdded(
  event: DIDAttributeItemAddedEvent
): void {
  if (!constants.ArrayAttributeSet.has(event.params.name)) {
    log.error("not expected array attribute", [event.params.name])
  }

  let did = uint128ToDID(event.params.identifier);
  let didEntify = DIDDocument.load(did)
  if (didEntify == null) {
    log.error("did not found", [did])
    return;
  }

  if (event.params.name == constants.ArrayAttributes.CONTEXT) {
    if (didEntify.context == null) {
      didEntify.context = [event.params.value.toString()]
    } else {
      didEntify.context!.push(event.params.value.toString());
    }
  } else if (event.params.name == constants.ArrayAttributes.ALSO_KNOWN_AS) {
    if (didEntify.alsoKnownAs == null) {
      didEntify.alsoKnownAs = [event.params.value.toString()]
    } else {
      didEntify.alsoKnownAs!.push(event.params.value.toString());
    }
  } else {
    ArrayAttributeHandler.addArrayAttibuteEntity(did, event.params.name, event.params.index.toString(), event.params.value)
  }
}

export function handleDIDAttributeItemRevoked(
  event: DIDAttributeItemRevokedEvent
): void {
  if (!constants.ArrayAttributeSet.has(event.params.name)) {
    log.error("not expected array attribute", [event.params.name])
  }

  let did = uint128ToDID(event.params.identifier);
  let didEntify = DIDDocument.load(did)
  if (didEntify == null) {
    log.error("did not found", [did])
    return;
  }

  ArrayAttributeHandler.removeArrayAttributeEntity(did, event.params.name, event.params.index.toString())
}

export function handleDIDAttributeSet(event: DIDAttributeSetEvent): void {
  if (!constants.KvAttribute.has(event.params.name)) {
    log.error("not expected kv attribute", [event.params.name])
  }

  let did = uint128ToDID(event.params.identifier);
  let didEntify = DIDDocument.load(did)
  if (!didEntify) {
    log.error("did not found", [did])
    return
  }
}

export function handleDIDAttributeRevoked(
  event: DIDAttributeRevokedEvent
): void {
  if (!constants.KvAttribute.has(event.params.name)) {
    log.error("not expected kv attribute", [event.params.name])
  }

  let did = uint128ToDID(event.params.identifier);
  let didEntify = DIDDocument.load(did)
  if (!didEntify) {
    log.error("did not found", [did])
    return
  }
}

export function handleDIDControllerAdded(event: DIDControllerAddedEvent): void {
  let did = uint128ToDID(event.params.identifier);
  let didEntify = DIDDocument.load(did)
  if (!didEntify) {
    log.error("did not found", [did])
    return
  }

  let controller = uint128ToDID(event.params.controller)
  didEntify.controller.push(controller)

  didEntify.save()
}

export function handleDIDControllerRevoked(
  event: DIDControllerRevokedEvent
): void {
  let did = uint128ToDID(event.params.identifier);
  let didEntify = DIDDocument.load(did)
  if (!didEntify) {
    log.error("did not found", [did])
    return
  }

  let controller = uint128ToDID(event.params.controller)
  let controllers = didEntify.controller;
  let found = false;
  for (let i = 0; i < controllers.length; i++) {
    if (controllers[i] == controller) {
      log.info("controller removed, did: {}, controller: {}", [did, controller])
      controllers.splice(i, 1)
      found = true;
      break
    }
  }

  if (!found) {
    log.error("controller not found, did: {}, controller: {}", [did, controller])
    return
  }

  didEntify.save()
}

export function handleDIDOwnerChanged(event: DIDOwnerChangedEvent): void {
  let did = uint128ToDID(event.params.identifier);
  let didEntify = DIDDocument.load(did)
  if (!didEntify) {
    log.error("did not found", [did])
    return
  }

  if (didEntify.owner != event.params.oldOwner) {
    log.error("old owner not match, current owner: {}, old owner: {}", [didEntify.owner.toHexString(), event.params.oldOwner.toHexString()])
    return
  }

  didEntify.owner = event.params.newOwner

  didEntify.save()
}

export function handleDIDRegistered(event: DIDRegisteredEvent): void {
  let did = uint128ToDID(event.params.identifier);
  let entity = new DIDDocument(
    did
  )
  entity.controller = [did];
  entity.owner = event.params.owner;

  entity.save()
}

export function handleInitialized(event: InitializedEvent): void {
  // let entity = new Initialized(
  //   event.transaction.hash.concatI32(event.logIndex.toI32())
  // )
  // entity.version = event.params.version

  // entity.blockNumber = event.block.number
  // entity.blockTimestamp = event.block.timestamp
  // entity.transactionHash = event.transaction.hash

  // entity.save()
}

export function handleUpgraded(event: UpgradedEvent): void {
  // let entity = new Upgraded(
  //   event.transaction.hash.concatI32(event.logIndex.toI32())
  // )
  // entity.implementation = event.params.implementation

  // entity.blockNumber = event.block.number
  // entity.blockTimestamp = event.block.timestamp
  // entity.transactionHash = event.transaction.hash

  // entity.save()
}