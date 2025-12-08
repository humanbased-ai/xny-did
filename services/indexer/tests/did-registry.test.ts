import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach
} from "matchstick-as/assembly/index"
import { BigInt, Bytes, Address, log, json } from "@graphprotocol/graph-ts"
import { DIDAttributeItemAdded as DIDAttributeItemAddedEvent } from "../generated/DIDRegistry/DIDRegistry"
import { handleDIDAttributeItemAdded, handleDIDRegistered, handleDIDAttributeSet, handleDIDAttributeRevoked } from "../src/did-registry"
import { createDIDAttributeItemAddedEvent, createDIDRegisteredEvent, createDIDAttributeSetEvent, createDIDAttributeRevokedEvent } from "./did-registry-utils"
import { uint128ToDID } from "../src/utils"
import { Authentication, DIDDocument, Service, SingleMethod, VerificationMethod } from "../generated/schema"
import { Logger } from "../src/logger"
import {TestLoggerBackend} from "./logger"
import {KvAttribute} from "../src/constants"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

const identifier = BigInt.fromI32(234)
const did = uint128ToDID(identifier)
const owner = Address.fromBytes(Bytes.fromHexString("0x3db6B0550FBB3f84CD71859f2B5b16BA1a0fA67a"))

const stringValue = "string value"
const didValue = did

function registerDID(): void {
  let newDIDRegisteredEvent = createDIDRegisteredEvent(
    identifier,
    owner
  )
  handleDIDRegistered(newDIDRegisteredEvent)
}

// describe("DID Registered", () => {
//   beforeAll(() => {
//     let newDIDRegisteredEvent = createDIDRegisteredEvent(
//       identifier,
//       owner
//     )
//     handleDIDRegistered(newDIDRegisteredEvent)
//   })

//   afterAll(() => {
//     clearStore()
//   })

//   // For more test scenarios, see:
//   // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

//   test("DIDRegistred created and stored", () => {
//     assert.entityCount("DIDDocument", 1)

//     assert.fieldEquals(
//       "DIDDocument",
//       did,
//       "owner",
//       owner.toHexString()
//     )
//     let document = DIDDocument.load(did);
//     assert.assertNotNull(document, "document should not be null");
//     assert.assertTrue(document!.controller.length == 1, "controller length not 1");
//   })
// })

// describe("KV Attribute set", () => {
//   beforeAll(() => {
//     KvAttribute.add("testkv")
//   })

//   afterAll(() => {
//     clearStore()
//     KvAttribute.delete("testkv")
//   })

//   // For more test scenarios, see:
//   // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

//   test("DIDAttributeSet failed with name error", () => {
//     const testLogger = new TestLoggerBackend()
//     Logger.backend = testLogger

//     let newEvent = createDIDAttributeSetEvent(
//       identifier,
//       identifier,
//       "wrong",
//       Bytes.empty()
//     )
//     handleDIDAttributeSet(newEvent)
//     assert.assertTrue(testLogger.messages.pop().includes("not expected kv attribute") as boolean)
//   })

//   test("DIDAttributeSet failed with did not found", () => {
//     const testLogger = new TestLoggerBackend()
//     Logger.backend = testLogger
    
//     let newEvent = createDIDAttributeSetEvent(
//       identifier,
//       identifier,
//       "testkv",
//       Bytes.empty()
//     )
//     handleDIDAttributeSet(newEvent)
//     assert.assertTrue(testLogger.messages.pop().includes("did not found") as boolean)
//   })
// })

// describe("KV Attribute revoked", () => {
//   afterAll(() => {
//     clearStore()
//   })

//   // For more test scenarios, see:
//   // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

//   test("DIDAttributeRevoked created with name error", () => {
//     let newEvent = createDIDAttributeRevokedEvent(
//       identifier,
//       identifier,
//       "wrong",
//       Bytes.empty()
//     )
//     handleDIDAttributeRevoked(newEvent)
//   })
// })

describe("Array Attribute added", () => {
  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  // test("DIDAttributeItemAdded failed with name error", () => {
  //   const testLogger = new TestLoggerBackend()
  //   Logger.backend = testLogger

  //   let newEvent = createDIDAttributeItemAddedEvent(
  //     identifier,
  //     identifier,
  //     "wrong",
  //     BigInt.fromString("0"),
  //     Bytes.empty()
  //   )
  //   handleDIDAttributeItemAdded(newEvent)
  //   assert.assertTrue(testLogger.messages.pop().includes("not expected array attribute") as boolean)
  // })

  // test("DIDAttributeItemAdded failed with did not found", () => {
  //   const testLogger = new TestLoggerBackend()
  //   Logger.backend = testLogger

  //   let newEvent = createDIDAttributeItemAddedEvent(
  //     identifier,
  //     identifier,
  //     "authentication",
  //     BigInt.fromString("0"),
  //     Bytes.empty()
  //   )
  //   handleDIDAttributeItemAdded(newEvent)
  //   assert.assertTrue(testLogger.messages.pop().includes("did not found") as boolean)
  // })

  // describe("Context", () => {
  //   beforeEach(() => {
  //     registerDID()
  //   })

  //   afterEach(() => {
  //     clearStore()
  //   })

  //   test("Current context is null", () => {
  //     const testLogger = new TestLoggerBackend()
  //     Logger.backend = testLogger
      
  //     let newEvent = createDIDAttributeItemAddedEvent(
  //       identifier,
  //       identifier,
  //       "@context",
  //       BigInt.fromString("0"),
  //       Bytes.fromUTF8(stringValue)
  //     )
  //     handleDIDAttributeItemAdded(newEvent)

  //     let entity = DIDDocument.load(did)
  //     assert.assertNotNull(entity, "document should not be null")
  //     assert.assertNotNull(entity!.context, "context should not be null")
  //     assert.assertTrue(entity!.context!.length == 1, "context length should exactly 1")
  //     assert.assertTrue(entity!.context![0] == stringValue)
  //   })

  //   test("Current context is not null", () => {
  //     const testLogger = new TestLoggerBackend()
  //     Logger.backend = testLogger

  //     registerDID()
      
  //     let newEvent = createDIDAttributeItemAddedEvent(
  //       identifier,
  //       identifier,
  //       "@context",
  //       BigInt.fromString("0"),
  //       Bytes.fromUTF8(stringValue)
  //     )
  //     handleDIDAttributeItemAdded(newEvent)
  //     handleDIDAttributeItemAdded(newEvent)

  //     let entity = DIDDocument.load(did)
  //     assert.assertTrue(entity!.context!.length == 2)
  //     assert.assertTrue(entity!.context![0] == stringValue)
  //     assert.assertTrue(entity!.context![1] == stringValue)
  //   })
  // })

  // describe("Also known as", () => {
  //   beforeEach(() => {
  //     registerDID()
  //   })

  //   afterEach(() => {
  //     clearStore()
  //   })

  //   test("Current alsoKnownAs is null", () => {
  //     const testLogger = new TestLoggerBackend()
  //     Logger.backend = testLogger
      
  //     let newEvent = createDIDAttributeItemAddedEvent(
  //       identifier,
  //       identifier,
  //       "alsoKnownAs",
  //       BigInt.fromString("0"),
  //       Bytes.fromUTF8(stringValue)
  //     )
  //     handleDIDAttributeItemAdded(newEvent)

  //     let entity = DIDDocument.load(did)
  //     assert.assertTrue(entity!.alsoKnownAs!.length == 1)
  //     assert.assertTrue(entity!.alsoKnownAs![0] == stringValue)
  //   })

  //   test("Current alsoKnownAs is not null", () => {
  //     const testLogger = new TestLoggerBackend()
  //     Logger.backend = testLogger
      
  //     let newEvent = createDIDAttributeItemAddedEvent(
  //       identifier,
  //       identifier,
  //       "alsoKnownAs",
  //       BigInt.fromString("0"),
  //       Bytes.fromUTF8(stringValue)
  //     )
  //     handleDIDAttributeItemAdded(newEvent)
  //     handleDIDAttributeItemAdded(newEvent)

  //     let entity = DIDDocument.load(did)
  //     assert.assertTrue(entity!.alsoKnownAs!.length == 2)
  //     assert.assertTrue(entity!.alsoKnownAs![0] == stringValue)
  //     assert.assertTrue(entity!.alsoKnownAs![1] == stringValue)
  //   })
  // })

  describe("Verification method", () => {
    beforeEach(() => {
      registerDID()
    })

    afterEach(() => {
      clearStore()
    })

    test("value not json string", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "verificationMethod",
        BigInt.fromString("0"),
        Bytes.fromUTF8(stringValue)
      )

      handleDIDAttributeItemAdded(newEvent)
      assert.assertTrue(testLogger.messages.pop().includes("can not parse value") as boolean)
    })

    test("value not json object", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "verificationMethod",
        BigInt.fromString("0"),
        Bytes.fromUTF8('["asdf"]')
      )

      handleDIDAttributeItemAdded(newEvent)
      assert.assertTrue(testLogger.messages.pop().includes("the origin value is not an object") as boolean)
    })

    test("no type filed in value", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "verificationMethod",
        BigInt.fromString("0"),
        Bytes.fromUTF8('{"asdf":"asdf"}')
      )

      handleDIDAttributeItemAdded(newEvent)
      assert.assertTrue(testLogger.messages.pop().includes("no method type") as boolean)
    })

    test("the type of type field in value is not string", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "verificationMethod",
        BigInt.fromString("0"),
        Bytes.fromUTF8('{"type":123}')
      )

      handleDIDAttributeItemAdded(newEvent)
      assert.assertTrue(testLogger.messages.pop().includes("type value should be a string") as boolean)
    })

    test("lacking of controller", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "verificationMethod",
        BigInt.fromString("0"),
        Bytes.fromUTF8('{"type":"123"}')
      )

      handleDIDAttributeItemAdded(newEvent)

      let id = `${did}#vm_0`
      let entity = VerificationMethod.load(id)

      assert.assertNotNull(entity, "verification should not be null")
      assert.assertTrue(entity!.didDoc == did, "did doc error")
      let method = SingleMethod.load(entity!.method!)
      assert.assertTrue(method!.controller! == did, "controller should be did")
      assert.assertTrue(method!.type! == "123", "verification method type error")
      assert.assertTrue(method!.value! == Bytes.fromUTF8('{"type":"123"}'), "verification value error")
    })

    test("controller is integer", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "verificationMethod",
        BigInt.fromString("0"),
        Bytes.fromUTF8('{"type":"123","controller":123}')
      )

      handleDIDAttributeItemAdded(newEvent)

      let id = `${did}#vm_0`
      let entity = VerificationMethod.load(id)

      assert.assertNotNull(entity, "verification should not be null")
      assert.assertTrue(entity!.didDoc == did, "did doc error")
      let method = SingleMethod.load(entity!.method!)
      assert.assertTrue(method!.controller! == uint128ToDID(BigInt.fromI32(123)), "controller should be did")
      assert.assertTrue(method!.type! == "123", "verification method type error")
      assert.assertTrue(method!.value! == Bytes.fromUTF8('{"type":"123","controller":123}'), "verification value error")
    })

    test("controller is float", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "verificationMethod",
        BigInt.fromString("0"),
        Bytes.fromUTF8('{"type":"123","controller":123.45}')
      )

      handleDIDAttributeItemAdded(newEvent)
      assert.assertTrue(testLogger.messages.pop().includes("controller not integer") as boolean)
    })

    test("controller is string", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "verificationMethod",
        BigInt.fromString("0"),
        Bytes.fromUTF8('{"type":"123","controller":"123"}')
      )

      handleDIDAttributeItemAdded(newEvent)

      let id = `${did}#vm_0`
      let entity = VerificationMethod.load(id)

      assert.assertNotNull(entity, "verification should not be null")
      assert.assertTrue(entity!.didDoc == did, "did doc error")
      let method = SingleMethod.load(entity!.method!)
      assert.assertTrue(method!.controller! == uint128ToDID(BigInt.fromI32(123)), "controller should be did")
      assert.assertTrue(method!.type! == "123", "verification method type error")
      assert.assertTrue(method!.value! == Bytes.fromUTF8('{"type":"123","controller":"123"}'), "verification value error")
    })

    test("type of controller error", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "verificationMethod",
        BigInt.fromString("0"),
        Bytes.fromUTF8('{"type":"123","controller":["123"]}')
      )

      handleDIDAttributeItemAdded(newEvent)
      assert.assertTrue(testLogger.messages.pop().includes("type of controller error") as boolean)
    })
  })

  describe("Authentication", () => {
    beforeEach(() => {
      registerDID()
    })

    afterEach(() => {
      clearStore()
    })

    test("value is string but not a did", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "authentication",
        BigInt.fromString("0"),
        Bytes.fromUTF8(stringValue)
      )

      handleDIDAttributeItemAdded(newEvent)
      assert.assertTrue(testLogger.messages.pop().includes("not a valid did") as boolean)
    })

    test("value is a did string", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "authentication",
        BigInt.fromString("0"),
        Bytes.fromUTF8(did)
      )

      handleDIDAttributeItemAdded(newEvent)
      
      let id = `${did}#auth_0`
      let entity = Authentication.load(id)
      assert.assertNotNull(entity, "entity should not be null")
      assert.assertTrue(entity!.id! == id, "id not match")
      assert.assertTrue(entity!.uri! == did, "uri error")
      assert.assertNull(entity!.method, "method should be null")
    })

    test("value is object", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "authentication",
        BigInt.fromString("0"),
        Bytes.fromUTF8('{"type":"123"}')
      )

      handleDIDAttributeItemAdded(newEvent)
      
      let id = `${did}#auth_0`
      let entity = Authentication.load(id)
      assert.assertNotNull(entity, "entity should not be null")
      let method = SingleMethod.load(id)
      assert.assertNotNull(method, "method should not be null")
      assert.assertTrue(method!.id! == id, "id not match")
    })
  })

  describe("Service", () => {
    beforeEach(() => {
      registerDID()
    })

    afterEach(() => {
      clearStore()
    })

    test("value not json string", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "service",
        BigInt.fromString("0"),
        Bytes.fromUTF8(stringValue)
      )

      handleDIDAttributeItemAdded(newEvent)
      assert.assertTrue(testLogger.messages.pop().includes("can not parse value") as boolean)
    })

    test("value is not object", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "service",
        BigInt.fromString("0"),
        Bytes.fromUTF8('["asdf"]')
      )

      handleDIDAttributeItemAdded(newEvent)
      assert.assertTrue(testLogger.messages.pop().includes("json value type error") as boolean)
    })

    test("value is object with no type field", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "service",
        BigInt.fromString("0"),
        Bytes.fromUTF8('{"asdf":"asdf"}')
      )

      handleDIDAttributeItemAdded(newEvent)
      assert.assertTrue(testLogger.messages.pop().includes("no type field in service") as boolean)
    })

    test("value is object with type field not string", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "service",
        BigInt.fromString("0"),
        Bytes.fromUTF8('{"type":123}')
      )

      handleDIDAttributeItemAdded(newEvent)
      assert.assertTrue(testLogger.messages.pop().includes("type of service type not string") as boolean)
    })

    test("value is object with no serviceEndpoint field", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "service",
        BigInt.fromString("0"),
        Bytes.fromUTF8('{"type":"123"}')
      )

      handleDIDAttributeItemAdded(newEvent)
      assert.assertTrue(testLogger.messages.pop().includes("no serviceEndpoint field in service") as boolean)
    })

    test("value is right", () => {
      const testLogger = new TestLoggerBackend()
      Logger.backend = testLogger
      
      let newEvent = createDIDAttributeItemAddedEvent(
        identifier,
        identifier,
        "service",
        BigInt.fromString("0"),
        Bytes.fromUTF8('{"type":"123","serviceEndpoint":"serviceEndpoint"}')
      )

      handleDIDAttributeItemAdded(newEvent)
      
      let id = `${did}#service_0`
      let entity = Service.load(id)
      assert.assertNotNull(entity, "service entity should not be null")
      assert.assertTrue(entity!.type == "123", "type error")
      assert.assertTrue(entity!.serviceEndpoint == Bytes.fromUTF8('{"type":"123","serviceEndpoint":"serviceEndpoint"}'), "type serviceEndpoint")
    })
  })
})