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
import { log } from "@graphprotocol/graph-ts"

export function handleDIDRegistered(event: DIDRegisteredEvent): void {
  let did = uint128ToDID(event.params.identifier);
  let entity = new DIDDocument(
    did
  )
  entity.controller = [did];
  entity.owner = event.params.owner;

  entity.save()
}
