// What graph-node's host functions actually do with malformed UTF-8.
//
// The resolver has two backends that are required to be indistinguishable: one reads
// this subgraph, the other reads the registry contract directly and reproduces what
// these handlers would have stored. That parity argument rests on host-function
// behaviour — `json.fromBytes` and `typeConversion.bytesToString` are Rust
// implementations declared as bare externals in graph-ts, so nothing in either
// codebase can show what they do. These tests measure it, so the resolver can match
// it deliberately instead of by assumption. See IN-3167.
import {
  assert,
  describe,
  test,
  clearStore,
  beforeEach,
  afterEach,
} from 'matchstick-as/assembly/index';
import { BigInt, Bytes, Address, json, JSONValueKind } from '@graphprotocol/graph-ts';
import { handleDIDAttributeItemAdded, handleDIDRegistered } from '../src/did-registry';
import { createDIDAttributeItemAddedEvent, createDIDRegisteredEvent } from './did-registry-utils';
import { uint128ToDID } from '../src/utils';
import { DIDDocument, VerificationMethod } from '../generated/schema';
import { Logger } from '../src/logger';
import { TestLoggerBackend } from './logger';

const identifier = BigInt.fromI32(234);
const did = uint128ToDID(identifier);
const owner = Address.fromBytes(Bytes.fromHexString('0x3db6B0550FBB3f84CD71859f2B5b16BA1a0fA67a'));

// A well-formed verification method blob whose `type` value carries a bad byte.
// {"type":"a\xffb","controller":"123"} — 0xff can never appear in valid UTF-8.
const VM_INVALID = '0x7b2274797065223a2261ff62222c22636f6e74726f6c6c6572223a22313233227d';
// {"type":"a\xc0\xafb","controller":"123"} — 0xc0 0xaf is an overlong encoding of '/',
// rejected by UTF-8 precisely because it is a second spelling of a codepoint that
// already has a one-byte form.
const VM_OVERLONG = '0x7b2274797065223a2261c0af62222c22636f6e74726f6c6c6572223a22313233227d';
// {"type":"a/b","controller":"123"} — the same text with a genuine '/'.
const VM_PLAIN = '0x7b2274797065223a22612f62222c22636f6e74726f6c6c6572223a22313233227d';

// The same three byte patterns without the JSON wrapper, for the alsoKnownAs path,
// which the handler decodes with Bytes.toString() rather than parsing.
const AKA_INVALID = '0x61ff62'; // a\xffb
const AKA_OVERLONG = '0x61c0af62'; // a\xc0\xafb

const REPLACEMENT = String.fromCharCode(0xfffd);

function register(): void {
  handleDIDRegistered(createDIDRegisteredEvent(identifier, owner));
}

function addItem(name: string, index: i32, hex: string): void {
  handleDIDAttributeItemAdded(
    createDIDAttributeItemAddedEvent(
      identifier,
      identifier,
      name,
      BigInt.fromString(index.toString()),
      Bytes.fromHexString(hex),
    ),
  );
}

describe('graph-node UTF-8 semantics (IN-3167)', () => {
  beforeEach(() => {
    Logger.backend = new TestLoggerBackend();
    register();
  });

  afterEach(() => {
    clearStore();
  });

  describe('json.fromBytes rejects malformed UTF-8 rather than substituting', () => {
    test('a blob containing an invalid byte does not parse', () => {
      assert.assertTrue(json.try_fromBytes(Bytes.fromHexString(VM_INVALID)).isError);
    });

    test('a blob containing an overlong encoding does not parse', () => {
      // Worth pinning separately: a lossy decoder would have turned these two bytes
      // into a valid '/' and parsed successfully. The JSON parser is stricter than
      // Bytes.toString() is, which is the whole reason the resolver needs two
      // different decode paths.
      assert.assertTrue(json.try_fromBytes(Bytes.fromHexString(VM_OVERLONG)).isError);
    });

    test('the same blob with a genuine slash parses', () => {
      // Guards against the two assertions above passing for an unrelated reason,
      // such as the fixtures not being valid JSON in the first place.
      let result = json.try_fromBytes(Bytes.fromHexString(VM_PLAIN));
      assert.assertTrue(!result.isError);
      assert.assertTrue(result.value.kind == JSONValueKind.OBJECT);
      assert.stringEquals('a/b', result.value.toObject().get('type')!.toString());
    });
  });

  describe('a rejected blob stores no entity at all', () => {
    test('an invalid byte means no VerificationMethod', () => {
      addItem('verificationMethod', 0, VM_INVALID);
      assert.assertNull(VerificationMethod.load(`${did}#vm_0`));
    });

    test('an overlong encoding means no VerificationMethod', () => {
      addItem('verificationMethod', 0, VM_OVERLONG);
      assert.assertNull(VerificationMethod.load(`${did}#vm_0`));
    });

    test('a valid blob at the same index does store one', () => {
      addItem('verificationMethod', 0, VM_PLAIN);
      assert.assertNotNull(VerificationMethod.load(`${did}#vm_0`));
    });
  });

  describe('Bytes.toString() substitutes per bad byte', () => {
    test('an invalid byte becomes one replacement character', () => {
      addItem('alsoKnownAs', 0, AKA_INVALID);
      let aka = DIDDocument.load(did)!.alsoKnownAs!;
      assert.i32Equals(1, aka.length);
      assert.stringEquals('a' + REPLACEMENT + 'b', aka[0]);
    });

    test('an overlong encoding becomes two replacement characters, not the codepoint', () => {
      // The distinction that matters to the resolver: this decoder does not accept an
      // overlong form and yield the codepoint it spells. A decoder that did would
      // store 'a/b' here — indistinguishable from a genuine '/' on-chain — and would
      // disagree with this subgraph about the same bytes.
      addItem('alsoKnownAs', 0, AKA_OVERLONG);
      let aka = DIDDocument.load(did)!.alsoKnownAs!;
      assert.i32Equals(1, aka.length);
      assert.stringEquals('a' + REPLACEMENT + REPLACEMENT + 'b', aka[0]);
      assert.assertTrue(aka[0] != 'a/b');
    });
  });
});
