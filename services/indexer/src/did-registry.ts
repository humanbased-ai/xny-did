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
  Upgraded
} from "../generated/schema"

export function handleDIDAttributeItemAdded(
  event: DIDAttributeItemAddedEvent
): void {
  let entity = new DIDAttributeItemAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.identifier = event.params.identifier
  entity.operator = event.params.operator
  entity.name = event.params.name
  entity.index = event.params.index
  entity.value = event.params.value

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleDIDAttributeItemRevoked(
  event: DIDAttributeItemRevokedEvent
): void {
  let entity = new DIDAttributeItemRevoked(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.identifier = event.params.identifier
  entity.operator = event.params.operator
  entity.name = event.params.name
  entity.index = event.params.index
  entity.value = event.params.value

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleDIDAttributeRevoked(
  event: DIDAttributeRevokedEvent
): void {
  let entity = new DIDAttributeRevoked(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.identifier = event.params.identifier
  entity.operator = event.params.operator
  entity.name = event.params.name
  entity.value = event.params.value

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleDIDAttributeSet(event: DIDAttributeSetEvent): void {
  let entity = new DIDAttributeSet(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.identifier = event.params.identifier
  entity.operator = event.params.operator
  entity.name = event.params.name
  entity.value = event.params.value

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleDIDControllerAdded(event: DIDControllerAddedEvent): void {
  let entity = new DIDControllerAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.identifier = event.params.identifier
  entity.operator = event.params.operator
  entity.controller = event.params.controller

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleDIDControllerRevoked(
  event: DIDControllerRevokedEvent
): void {
  let entity = new DIDControllerRevoked(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.identifier = event.params.identifier
  entity.operator = event.params.operator
  entity.controller = event.params.controller

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleDIDOwnerChanged(event: DIDOwnerChangedEvent): void {
  let entity = new DIDOwnerChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.identifier = event.params.identifier
  entity.oldOwner = event.params.oldOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleDIDRegistered(event: DIDRegisteredEvent): void {
  let entity = new DIDRegistered(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.identifier = event.params.identifier
  entity.owner = event.params.owner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleInitialized(event: InitializedEvent): void {
  let entity = new Initialized(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.version = event.params.version

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleUpgraded(event: UpgradedEvent): void {
  let entity = new Upgraded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.implementation = event.params.implementation

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
