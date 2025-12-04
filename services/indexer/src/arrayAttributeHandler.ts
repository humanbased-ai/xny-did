import { json, JSONValue, JSONValueKind, log, BigInt, Bytes, Entity, store } from "@graphprotocol/graph-ts";
import {ArrayAttributes} from "./constants";
import {SingleMethod, VerificationMethod} from "../generated/schema";
import * as utils from "./utils";

export class ArrayAttributeHandler {
    static addArrayAttibuteEntity(did: string, name: string, index: string, value: Bytes): Entity | null {
        if (name == ArrayAttributes.VERIFICATION_METHOD) {
            return newVerificationMethod(did, name, index, value);
        } else if (name == ArrayAttributes.AUTHENTICATION) {

        } else if (name == ArrayAttributes.ASSERTION_METHOD) {

        } else if (name == ArrayAttributes.KEY_AGREEMENT) {

        } else if (name == ArrayAttributes.CAPABILITY_INVOCATION) {

        } else if (name == ArrayAttributes.CAPABILITY_DELEGATION) {

        } else if (name == ArrayAttributes.SERVICE) {

        }
        return null;
    }

    static removeArrayAttributeEntity(did: string, name: string, index: string) {
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
            // let id = `${did}#auth_${index}`
            // store.remove("Service", id);
        }
    }
}

function newContext(did: string, name: string, value: Bytes): Entity {
    // let entity = new 
}

function newVerificationMethod(did: string, name: string, index: string, value: Bytes): Entity | null {
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

    let entity = new VerificationMethod(id);
    let method = new SingleMethod(id);
    method.controller = controllerValue;
    method.type = typeValue;
    method.value = value.toString();
    method.parentId = id;
    method.parentType = "VerificationMethod";
    entity.method = id;

    return entity;
}

// function newAlsoKnownAs(did: string, name: string, value: Bytes) {

// }

// function newAuthentication(did: string, name: string, value: Bytes) {

// }

// function newAssertionMethod(did: string, name: string, value: Bytes) {

// }

// function newKeyAgreement(did: string, name: string, value: Bytes) {

// }

// function newCapabilityInvocation(did: string, name: string, value: Bytes) {

// }

// function newCapabilityDelegation(did: string, name: string, value: Bytes) {

// }

// function newService(did: string, name: string, value: Bytes) {
    
// }