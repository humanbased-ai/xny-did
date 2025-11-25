import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts"
import { DIDAttributeItemAdded } from "../generated/schema"
import { DIDAttributeItemAdded as DIDAttributeItemAddedEvent } from "../generated/DIDRegistry/DIDRegistry"
import { handleDIDAttributeItemAdded } from "../src/did-registry"
import { createDIDAttributeItemAddedEvent } from "./did-registry-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let identifier = BigInt.fromI32(234)
    let operator = BigInt.fromI32(234)
    let name = "Example string value"
    let index = BigInt.fromI32(234)
    let value = Bytes.fromI32(1234567890)
    let newDIDAttributeItemAddedEvent = createDIDAttributeItemAddedEvent(
      identifier,
      operator,
      name,
      index,
      value
    )
    handleDIDAttributeItemAdded(newDIDAttributeItemAddedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  test("DIDAttributeItemAdded created and stored", () => {
    assert.entityCount("DIDAttributeItemAdded", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "DIDAttributeItemAdded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "identifier",
      "234"
    )
    assert.fieldEquals(
      "DIDAttributeItemAdded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "operator",
      "234"
    )
    assert.fieldEquals(
      "DIDAttributeItemAdded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "name",
      "Example string value"
    )
    assert.fieldEquals(
      "DIDAttributeItemAdded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "index",
      "234"
    )
    assert.fieldEquals(
      "DIDAttributeItemAdded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "value",
      "1234567890"
    )

    // More assert options:
    // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#asserts
  })
})
