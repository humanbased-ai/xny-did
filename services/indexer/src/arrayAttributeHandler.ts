import { json, JSONValue, JSONValueKind, log, BigInt, Bytes, Entity, store, ValueKind } from "@graphprotocol/graph-ts";
import {ArrayAttributes} from "./constants";
import {Authentication, SingleMethod, VerificationMethod, Service, CapabilityDelegation, CapabilityInvocation, KeyAgreement, AssertionMethod} from "../generated/schema";
import * as utils from "./utils";

export class ArrayAttributeHandler {
    static addArrayAttibuteEntity(did: string, name: string, index: string, value: Bytes): void {
        if (name == ArrayAttributes.VERIFICATION_METHOD) {
            addVerificationMethod(did, index, value);
        } else if (name == ArrayAttributes.AUTHENTICATION) {
            addAuthentication(did, index, value)
        } else if (name == ArrayAttributes.ASSERTION_METHOD) {
            addAssertionMethod(did, index, value)
        } else if (name == ArrayAttributes.KEY_AGREEMENT) {
            addKeyAgreement(did, index, value)
        } else if (name == ArrayAttributes.CAPABILITY_INVOCATION) {
            addCapabilityInvocation(did, index, value)
        } else if (name == ArrayAttributes.CAPABILITY_DELEGATION) {
            addCapabilityDelegation(did, index, value)
        } else if (name == ArrayAttributes.SERVICE) {
            addService(did, index, value)
        }
    }

    static removeArrayAttributeEntity(did: string, name: string, index: string): void {
        if (name == ArrayAttributes.VERIFICATION_METHOD) {
            let id = `${did}#vm_${index}`
            store.remove("VerificationMethod", id);
        } else if (name == ArrayAttributes.AUTHENTICATION) {
            let id = `${did}#auth_${index}`
            store.remove("Authentication", id);
        } else if (name == ArrayAttributes.ASSERTION_METHOD) {
            let id = `${did}#am_${index}`
            store.remove("AssertionMethod", id);
        } else if (name == ArrayAttributes.KEY_AGREEMENT) {
            let id = `${did}#ka_${index}`
            store.remove("KeyAgreement", id);
        } else if (name == ArrayAttributes.CAPABILITY_INVOCATION) {
            let id = `${did}#ci_${index}`
            store.remove("CapabilityInvocation", id);
        } else if (name == ArrayAttributes.CAPABILITY_DELEGATION) {
            let id = `${did}#cd_${index}`
            store.remove("CapabilityDelegation", id);
        } else if (name == ArrayAttributes.SERVICE) {
            let id = `${did}#service_${index}`
            store.remove("Service", id);
        }
    }
}

function addSingleMethod(did: string, parentType: string, index: string, value: Bytes): SingleMethod | null {
    // parse value
    let jsonValue = json.fromString(value.toString())
    if (jsonValue.isNull()) {
        log.warning("can not parse value {} as json", [value.toHexString()])
        return null;
    }

    // origin value data should be an object
    if (jsonValue.kind != JSONValueKind.OBJECT) {
        log.warning("the origin value is not an object", []);
        return null;
    }

    let jsonObject = jsonValue.toObject()

    // type MUST HAVE
    let typeJsonValue = jsonObject.get("type")
    if (typeJsonValue == null) {
        log.warning("no method type", []);
        return null
    }

    if (typeJsonValue.kind != JSONValueKind.STRING) {
        log.warning("type value should be a string", []);
        return null
    }

    let typeValue = typeJsonValue.toString();

    // controller OPTIONAL
    let controllerJsonValue = jsonObject.get("controller")
    let controllerValue = "";
    if (controllerJsonValue == null) {
        controllerValue = did
    } else {
        if (controllerJsonValue.kind == JSONValueKind.NUMBER) {
            let controllerF64 = controllerJsonValue.toF64()
            if (controllerF64 != Math.floor(controllerF64)) {
                log.warning("controller not integer", [])
                return null
            }
            let idValue: BigInt = BigInt.fromI64(<i64>controllerF64)
            controllerValue = utils.uint128ToDID(idValue)
        } else if (controllerJsonValue.kind == JSONValueKind.STRING) {
            let idValue: BigInt = BigInt.fromString(controllerJsonValue.toString())
            controllerValue = utils.uint128ToDID(idValue)
        } else {
            log.warning("type of controller error", [controllerJsonValue.kind.toString()])
            return null
        }
    }
    
    let id = `${did}#vm_${index}`

    let method = new SingleMethod(id);
    method.controller = controllerValue;
    method.type = typeValue;
    method.value = value.toString();
    method.parentId = id;
    method.parentType = parentType;

    method.save()

    return method
}

function addVerificationMethod(did: string, index: string, value: Bytes): void {
    let method = addSingleMethod(did, "VerificationMethod", index, value)

    if (method == null) {
        return;
    }

    let entity = new VerificationMethod(method.id);
    entity.method = method.id;

    return;
}

class AuthParam {
    id: string;
    uri: string | null;
    method: string | null;
}

function getAuthParams(did: string, name: string, authPrefix: string, index: string, value: Bytes): AuthParam | null {
    // parse value
    let jsonValue = json.fromString(value.toString())
    if (jsonValue.isNull()) {
        log.warning("can not parse value {} as json", [value.toHexString()])
        return null;
    }

    let id = `${did}#${authPrefix}_${index}`
    // if string, it should be a did
    if (jsonValue.kind == JSONValueKind.STRING) {
        let stringValue = jsonValue.toString()
        if (!utils.isValidDID(stringValue)) {
            log.error("not a valid did: {}", [stringValue])
            return null;
        }

        return {id, uri: stringValue, method: null}
    } else if (jsonValue.kind == JSONValueKind.OBJECT) {
        let method = addSingleMethod(did, name, index, value)

        if (method == null) {
            return null;
        }

        return {id, uri: null, method: method.id}
    } else {
        log.error("json value type error: {}", [jsonValue.kind.toString()])
        return null;
    }
}

function addAuthentication(did: string, index: string, value: Bytes): void {
    let params = getAuthParams(did, "authentication", "auth", index, value)
    if (!params) {
        return
    }

    let entity = new Authentication(params.id);
    entity.didDoc = did;
    entity.uri = params.uri;
    entity.method = params.method;

    entity.save()
}

function addAssertionMethod(did: string, index: string, value: Bytes): void {
    let params = getAuthParams(did, "assertionMethod", "am", index, value)
    if (!params) {
        return
    }

    let entity = new AssertionMethod(params.id);
    entity.didDoc = did;
    entity.uri = params.uri;
    entity.method = params.method;

    entity.save()
}

function addKeyAgreement(did: string, index: string, value: Bytes): void {
    let params = getAuthParams(did, "keyAgreement", "ka", index, value)
    if (!params) {
        return
    }

    let entity = new KeyAgreement(params.id);
    entity.didDoc = did;
    entity.uri = params.uri;
    entity.method = params.method;

    entity.save()
}

function addCapabilityInvocation(did: string, index: string, value: Bytes): void {
    let params = getAuthParams(did, "capabilityInvocation", "ci", index, value)
    if (!params) {
        return
    }

    let entity = new CapabilityInvocation(params.id);
    entity.didDoc = did;
    entity.uri = params.uri;
    entity.method = params.method;

    entity.save()
}

function addCapabilityDelegation(did: string, index: string, value: Bytes): void {
    let params = getAuthParams(did, "capabilityDelegation", "cd", index, value)
    if (!params) {
        return
    }

    let entity = new CapabilityDelegation(params.id);
    entity.didDoc = did;
    entity.uri = params.uri;
    entity.method = params.method;

    entity.save()
}

function addService(did: string, index: string, value: Bytes): void {
    // parse value
    let jsonValue = json.fromString(value.toString())
    if (jsonValue.isNull()) {
        log.warning("can not parse value {} as json", [value.toHexString()])
        return;
    }

    if (jsonValue.kind != JSONValueKind.OBJECT) {
        log.error("json value type error: {}", [jsonValue.kind.toString()])
        return
    }

    let jsonObject = jsonValue.toObject()

    // get service type
    let typeJsonValue = jsonObject.get("type")
    if (typeJsonValue == null) {
        log.error("no type field in service", [])
        return
    }

    if (typeJsonValue.kind != JSONValueKind.STRING) {
        log.error("type of service type", [typeJsonValue.kind.toString()])
        return
    }

    let typeValue = typeJsonValue.toString()

    // get service
    let endpointJsonValue = jsonObject.get("serviceEndpoint")
    if (endpointJsonValue == null) {
        log.error("no serviceEndpoint field in service", [])
        return        
    }
    

    let id = `${did}#service_${index}`
    let entity = new Service(id)

    entity.didDoc = did
    entity.type = typeValue
    entity.serviceEndpoint = value

    entity.save()
}