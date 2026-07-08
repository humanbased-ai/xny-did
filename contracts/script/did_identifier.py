"""Off-chain helper for the deterministic did:xny identifier scheme.

Byte-identical to `DIDGenerator.deterministicUint128` in
contracts/src/lib/DIDGenerator.sol:

    identifier = uint128(uint256(keccak256(DOMAIN_SALT ++ utf8(userId))))

DOMAIN_SALT is the fixed 32-byte constant keccak256("did:xny:identifier:v1").
Because it is a constant-length prefix, the encoding of (salt, userId) is
unambiguous and reproducible on-chain and off-chain.

Run as a script to verify against the shared reference vectors:

    python did_identifier.py --check
    python did_identifier.py --user-id alice@example.com
"""

import argparse
import json
import sys
from pathlib import Path

from eth_utils import keccak  # provided by web3 / eth-hash

DOMAIN_SALT_PREIMAGE = "did:xny:identifier:v1"
DOMAIN_SALT = keccak(DOMAIN_SALT_PREIMAGE.encode("utf-8"))
UINT128_MASK = (1 << 128) - 1

VECTORS_PATH = Path(__file__).parent / "did_identifier_vectors.json"


def deterministic_uint128(user_id: str) -> int:
    """Derive the 128-bit identifier from an off-chain user id."""
    digest = keccak(DOMAIN_SALT + user_id.encode("utf-8"))
    return int.from_bytes(digest, "big") & UINT128_MASK


def to_layout_string(identifier: int) -> str:
    """Render a uint128 as the 8-4-4-4-12 hex layout (display only)."""
    if identifier < 0 or identifier > UINT128_MASK:
        raise ValueError("identifier must be a uint128")
    h = format(identifier, "032x")
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def to_did(user_id: str) -> str:
    return "did:xny:" + to_layout_string(deterministic_uint128(user_id))


def _check() -> int:
    with VECTORS_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if "0x" + DOMAIN_SALT.hex() != data["domainSalt"]:
        print(f"❌ DOMAIN_SALT mismatch: {DOMAIN_SALT.hex()} vs {data['domainSalt']}")
        return 1

    failures = 0
    for v in data["vectors"]:
        got = deterministic_uint128(v["userId"])
        want = int(v["identifier"], 16)
        did = to_did(v["userId"])
        ok = got == want and did == v["did"]
        mark = "✅" if ok else "❌"
        print(f"{mark} {v['userId']!r} -> {did}")
        if not ok:
            failures += 1
            print(f"    got  identifier={got} did={did}")
            print(f"    want identifier={want} did={v['did']}")

    if failures:
        print(f"\n{failures} vector(s) failed")
        return 1
    print(f"\nAll {len(data['vectors'])} vectors match.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user-id", "-u", help="Compute the identifier for a user id")
    parser.add_argument("--check", action="store_true", help="Verify against reference vectors")
    args = parser.parse_args()

    if args.check:
        sys.exit(_check())

    if args.user_id is not None:
        identifier = deterministic_uint128(args.user_id)
        print(f"user_id   : {args.user_id!r}")
        print(f"identifier: {identifier}")
        print(f"hex       : 0x{identifier:032x}")
        print(f"did       : {to_did(args.user_id)}")
        return

    parser.print_help()
    sys.exit(1)


if __name__ == "__main__":
    main()
