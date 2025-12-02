import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { BigInt, Bytes, Address, log } from "@graphprotocol/graph-ts"
import { DIDAttributeItemAdded as DIDAttributeItemAddedEvent } from "../generated/DIDRegistry/DIDRegistry"
import { handleDIDAttributeItemAdded, handleDIDRegistered } from "../src/did-registry"
import { createDIDAttributeItemAddedEvent, createDIDRegisteredEvent } from "./did-registry-utils"
import { uint128ToDID } from "../src/utils"
import { DIDDocument } from "../generated/schema"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

const identifier = BigInt.fromI32(234)
const did = uint128ToDID(identifier)
const owner = Address.fromBytes(Bytes.fromHexString("0x3db6B0550FBB3f84CD71859f2B5b16BA1a0fA67a"))

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let newDIDRegisteredEvent = createDIDRegisteredEvent(
      identifier,
      owner
    )
    handleDIDRegistered(newDIDRegisteredEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  test("DIDRegistred created and stored", () => {
    assert.entityCount("DIDDocument", 1)

    assert.fieldEquals(
      "DIDDocument",
      did,
      "owner",
      owner.toHexString()
    )
    let document = DIDDocument.load(did);
    assert.assertNotNull(document, "document should not be null");
    assert.assertTrue(document!.controller.length == 1, "controller length not 1");
  })
})
