import {
  json,
  JSONValue,
  JSONValueKind,
  log,
  BigInt,
  Bytes,
  Entity,
  store,
  ValueKind,
} from '@graphprotocol/graph-ts';
import { ArrayAttributes } from './constants';
import {
  Authentication,
  SingleMethod,
  VerificationMethod,
  Service,
  CapabilityDelegation,
  CapabilityInvocation,
  KeyAgreement,
  AssertionMethod,
} from '../generated/schema';
import * as utils from './utils';
import { Logger } from './logger';

export class ArrayAttributeHandler {
  static addArrayAttibuteEntity(did: string, name: string, index: string, value: Bytes): void {
    if (name == ArrayAttributes.VERIFICATION_METHOD) {
      addVerificationMethod(did, index, value);
    } else if (name == ArrayAttributes.AUTHENTICATION) {
      addAuthentication(did, index, value);
    } else if (name == ArrayAttributes.ASSERTION_METHOD) {
      addAssertionMethod(did, index, value);
    } else if (name == ArrayAttributes.KEY_AGREEMENT) {
      addKeyAgreement(did, index, value);
    } else if (name == ArrayAttributes.CAPABILITY_INVOCATION) {
      addCapabilityInvocation(did, index, value);
    } else if (name == ArrayAttributes.CAPABILITY_DELEGATION) {
      addCapabilityDelegation(did, index, value);
    } else if (name == ArrayAttributes.SERVICE) {
      addService(did, index, value);
    }
  }

  static removeArrayAttributeEntity(did: string, name: string, index: string): void {
    if (name == ArrayAttributes.VERIFICATION_METHOD) {
      let id = `${did}#vm_${index}`;
      store.remove('VerificationMethod', id);
    } else if (name == ArrayAttributes.AUTHENTICATION) {
      let id = `${did}#auth_${index}`;
      store.remove('Authentication', id);
    } else if (name == ArrayAttributes.ASSERTION_METHOD) {
      let id = `${did}#am_${index}`;
      store.remove('AssertionMethod', id);
    } else if (name == ArrayAttributes.KEY_AGREEMENT) {
      let id = `${did}#ka_${index}`;
      store.remove('KeyAgreement', id);
    } else if (name == ArrayAttributes.CAPABILITY_INVOCATION) {
      let id = `${did}#ci_${index}`;
      store.remove('CapabilityInvocation', id);
    } else if (name == ArrayAttributes.CAPABILITY_DELEGATION) {
      let id = `${did}#cd_${index}`;
      store.remove('CapabilityDelegation', id);
    } else if (name == ArrayAttributes.SERVICE) {
      let id = `${did}#service_${index}`;
      store.remove('Service', id);
    }
  }
}

function addSingleMethod(
  did: string,
  id: string,
  parentType: string,
  index: string,
  value: Bytes,
): SingleMethod | null {
  // parse value
  let result = json.try_fromBytes(value);
  if (result.isError) {
    Logger.error('addSingleMethod - can not parse value {} as json', [value.toHexString()]);
    return null;
  }

  let jsonValue = result.value;

  // origin value data should be an object
  if (jsonValue.kind != JSONValueKind.OBJECT) {
    Logger.error('addSingleMethod - the origin value is not an object', []);
    return null;
  }

  let jsonObject = jsonValue.toObject();

  // type MUST exist
  let typeJsonValue = jsonObject.get('type');
  if (typeJsonValue == null) {
    Logger.error('addSingleMethod - no method type', []);
    return null;
  }

  if (typeJsonValue.kind != JSONValueKind.STRING) {
    Logger.error('addSingleMethod - type value should be a string', []);
    return null;
  }

  let typeValue = typeJsonValue.toString();

  // controller OPTIONAL
  let controllerJsonValue = jsonObject.get('controller');
  let controllerValue = '';
  if (controllerJsonValue == null) {
    controllerValue = did;
  } else {
    if (controllerJsonValue.kind == JSONValueKind.NUMBER) {
      let controllerF64 = controllerJsonValue.toF64();
      if (controllerF64 != Math.floor(controllerF64)) {
        Logger.error('addSingleMethod - controller not integer', []);
        return null;
      }
      let idValue: BigInt = BigInt.fromI64(<i64>controllerF64);
      controllerValue = utils.uint128ToDID(idValue);
    } else if (controllerJsonValue.kind == JSONValueKind.STRING) {
      let idValue: BigInt = BigInt.fromString(controllerJsonValue.toString());
      controllerValue = utils.uint128ToDID(idValue);
    } else {
      Logger.error('addSingleMethod - type of controller error: {}', [controllerJsonValue.kind.toString()]);
      return null;
    }
  }

  let method = new SingleMethod(id);
  method.controller = controllerValue;
  method.type = typeValue;
  method.value = value;
  method.parentId = id;
  method.parentType = parentType;

  method.save();

  return method;
}

function addVerificationMethod(did: string, index: string, value: Bytes): void {
  let id = `${did}#vm_${index}`;
  let method = addSingleMethod(did, id, 'VerificationMethod', index, value);

  if (method == null) {
    return;
  }

  let entity = new VerificationMethod(method.id);
  entity.method = method.id;
  entity.didDoc = did;

  entity.save();

  return;
}

class AuthParam {
  id: string;
  uri: string | null;
  method: string | null;
}

function getAuthParams(
  did: string,
  name: string,
  authPrefix: string,
  index: string,
  value: Bytes,
): AuthParam | null {
  let id = `${did}#${authPrefix}_${index}`;
  // object first
  let method = addSingleMethod(did, id, name, index, value);
  if (method == null) {
    if (!utils.isValidDID(value.toString())) {
      Logger.error('getAuthParams - not a valid did: {}', [value.toHexString()]);
      return null;
    } else {
      return { id, uri: value.toString(), method: null };
    }
  } else {
    return { id, uri: null, method: method.id };
  }
}

function addAuthentication(did: string, index: string, value: Bytes): void {
  let params = getAuthParams(did, 'authentication', 'auth', index, value);
  if (!params) {
    return;
  }

  let entity = new Authentication(params.id);
  entity.didDoc = did;
  entity.uri = params.uri;
  entity.method = params.method;

  entity.save();
}

function addAssertionMethod(did: string, index: string, value: Bytes): void {
  let params = getAuthParams(did, 'assertionMethod', 'am', index, value);
  if (!params) {
    return;
  }

  let entity = new AssertionMethod(params.id);
  entity.didDoc = did;
  entity.uri = params.uri;
  entity.method = params.method;

  entity.save();
}

function addKeyAgreement(did: string, index: string, value: Bytes): void {
  let params = getAuthParams(did, 'keyAgreement', 'ka', index, value);
  if (!params) {
    return;
  }

  let entity = new KeyAgreement(params.id);
  entity.didDoc = did;
  entity.uri = params.uri;
  entity.method = params.method;

  entity.save();
}

function addCapabilityInvocation(did: string, index: string, value: Bytes): void {
  let params = getAuthParams(did, 'capabilityInvocation', 'ci', index, value);
  if (!params) {
    return;
  }

  let entity = new CapabilityInvocation(params.id);
  entity.didDoc = did;
  entity.uri = params.uri;
  entity.method = params.method;

  entity.save();
}

function addCapabilityDelegation(did: string, index: string, value: Bytes): void {
  let params = getAuthParams(did, 'capabilityDelegation', 'cd', index, value);
  if (!params) {
    return;
  }

  let entity = new CapabilityDelegation(params.id);
  entity.didDoc = did;
  entity.uri = params.uri;
  entity.method = params.method;

  entity.save();
}

function addService(did: string, index: string, value: Bytes): void {
  // parse value
  let result = json.try_fromBytes(value);
  if (result.isError) {
    Logger.error('addService - can not parse value {} as json', [value.toHexString()]);
    return;
  }

  let jsonValue = result.value;

  if (jsonValue.kind != JSONValueKind.OBJECT) {
    Logger.error('addService - json value type error: {}', [jsonValue.kind.toString()]);
    return;
  }

  let jsonObject = jsonValue.toObject();

  // get service type
  let typeJsonValue = jsonObject.get('type');
  if (typeJsonValue == null) {
    Logger.error('addService - no type field in service', []);
    return;
  }

  if (typeJsonValue.kind != JSONValueKind.STRING) {
    Logger.error('addService - type of service type not string: {}', [typeJsonValue.kind.toString()]);
    return;
  }

  let typeValue = typeJsonValue.toString();

  // get service
  let endpointJsonValue = jsonObject.get('serviceEndpoint');
  if (endpointJsonValue == null) {
    Logger.error('addService - no serviceEndpoint field in service', []);
    return;
  }

  let id = `${did}#service_${index}`;
  let entity = new Service(id);

  entity.didDoc = did;
  entity.type = typeValue;
  entity.serviceEndpoint = value;

  entity.save();
}
