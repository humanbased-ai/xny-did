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
    log.warning("not expected array attribute", [event.params.name])
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
    let entity = ArrayAttributeHandler.addArrayAttibuteEntity(did, event.params.name, event.params.index.toString(), event.params.value)
    if (entity == null) {
      log.warning("entity creating failed, did: {}, name: {}, index: {}", [did, event.params.name, event.params.index.toString()])
    }
  }
}

export function handleDIDAttributeItemRevoked(
  event: DIDAttributeItemRevokedEvent
): void {
  if (!constants.ArrayAttributeSet.has(event.params.name)) {
    log.warning("not expected array attribute", [event.params.name])
  }

  let did = uint128ToDID(event.params.identifier);
  let didEntify = DIDDocument.load(did)
  if (didEntify == null) {
    log.error("did not found", [did])
    return;
  }

  ArrayAttributeHandler.removeArrayAttributeEntity(did, event.params.name, event.params.index.toString(), event.params.value)
}

export function handleDIDAttributeSet(event: DIDAttributeSetEvent): void {
  if (!constants.KvAttribute.has(event.params.name)) {
    log.warning("not expected kv attribute", [event.params.name])
  }

  let did = uint128ToDID(event.params.identifier);
  let didEntify = DIDDocument.load(did)
  if (!didEntify) {
    log.error("did not found", [did])
  }
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
