export namespace ReserverdAttributes {
    export const ID = "id"
    export const OWNER = "owner"
    export const CONTROLLER = "controller"
}

export namespace ArrayAttributes {
    export const CONTEXT = "@context"
    export const VERIFICATION_METHOD = "verificationMethod"
    export const ALSO_KNOWN_AS = "alsoKnownAs"
    export const AUTHENTICATION ="authentication"
    export const ASSERTION_METHOD ="assertionMethod"
    export const KEY_AGREEMENT ="keyAgreement"
    export const CAPABILITY_INVOCATION ="capabilityInvocation"
    export const CAPABILITY_DELEGATION ="capabilityDelegation"
    export const SERVICE ="service"
}

export const ReservedAttributeSet = new Set<string>()
ReservedAttributeSet.add("id")
ReservedAttributeSet.add("owner")
ReservedAttributeSet.add("controller")

export const KvAttribute = new Set<string>()

export const ArrayAttributeSet = new Set<string>()
ArrayAttributeSet.add("@context")
ArrayAttributeSet.add("verificationMethod")
ArrayAttributeSet.add("alsoKnownAs")
ArrayAttributeSet.add("authentication")
ArrayAttributeSet.add("assertionMethod")
ArrayAttributeSet.add("keyAgreement")
ArrayAttributeSet.add("capabilityInvocation")
ArrayAttributeSet.add("capabilityDelegation")
ArrayAttributeSet.add("service")