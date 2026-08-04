# Xny DID

This repository provides the Solidity-based EVM implementation of the did:xny method.
It defines the smart contracts responsible for creating DIDs and recording DID Documents in a decentralized manner.

## Features

-   **Register**: Register DIDs on-chain.
-   **Manage**: Update controllers, verification methods, and other DID Document data.
-   **Retrieve**: Query existing DIDs and their corresponding documents.
-   **Subscibe**: Subscribe to DID-related events for off-chain synchronization.

## Usage

### Dependencies

- **[Foundry](https://getfoundry.sh/introduction/installation/)**

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Deploy

```shell
bash deploy.sh
```

The `deploy.sh` helper runs `DIDRegistry.s.sol` and `DIDRegistrar.s.sol` in
order against the local anvil node. For a production deployment, run the
scripts directly (see below) with the appropriate RPC URL and
`--broadcast`.

#### Deploy scripts

Each script reads prior contract addresses from
`script/config/deployment.<network>.json` and writes the new address back on
success. Run with
`forge script script/<file>.s.sol:<Contract>Script --rpc-url <url> --broadcast`.

`<network>` is derived from the chain id of whatever `--rpc-url` points at,
using the map in `script/config/networks.json` (e.g. `84532` → `base_sepolia`). An
unmapped chain id falls back to its decimal form
(`deployment.31338.json`), so deploying to a new chain needs no
configuration — add an entry to `networks.json` only if you want a readable
filename.

Every deployment file records its own `chainId`. That field, not the
filename, is what the scripts validate: loading or overwriting a file whose
`chainId` differs from the chain being talked to reverts with
`ChainIdMismatch` instead of silently pairing one network's addresses with
another network's RPC. Files predating this field are read as-is and gain
one on the next write.

| Script | Roles used | Persists to `deployment.<network>.json` |
| --- | --- | --- |
| `DIDRegistry.s.sol` | `owner` | `registryImpl`, `registryProxy` |
| `DIDRegistrar.s.sol` | — | `registrar` |
| `InviteRegistrar.s.sol` | `inviteSigner` | `inviteRegistrar` |
| `HumanbasedRegistrar.s.sol` | `relayer`, `platformOwner` | `humanbasedRegistrar` |
| `Upgrade.s.sol` | — | (no new addresses; upgrades the proxy in place) |

`DEPLOYER_PRIVATE_KEY` is the only environment variable the deploy scripts
read. The deployer pays gas and (for the registrar scripts) becomes the
contract's admin / Ownable owner.

#### What `.env` needs

`contracts/.env` is gitignored and auto-loaded by Foundry — for `forge test` as
well as `forge script`, so it holds secrets only:

| Variable | Needed for | Notes |
| --- | --- | --- |
| `DEPLOYER_PRIVATE_KEY` | every deploy / admin script | pays gas |
| `BASE_RPC_URL` | `--rpc-url base` | paid node; the URL embeds an API key, which is why it is not in `foundry.toml` |
| `BASESCAN_API_KEY` | `--verify` | |
| `OWNER_PRIVATE_KEY` | `manager.py` | |
| `USER_PRIVATE_KEY` | `register.py` | |
| `RPC_URL` | the Python scripts | falls back to `KITE_TEST_PRC_URL` |

**No address belongs in `.env`.** Role addresses live in
`script/config/roles.<network>.json` and contract addresses in
`script/config/deployment.<network>.json`, both validated against the connected
chain id. Switching networks therefore means changing `BASE_RPC_URL` and the key,
not hunting through addresses — and `OWNER` / `RELAYER_ADDRESS` /
`PLATFORM_OWNER_ADDRESS` / `INVITE_SIGNER` are no longer read at all, so leaving
stale copies in `.env` has no effect.

#### Role addresses

Role addresses live in `script/config/roles.<network>.json`, not in `.env`:

```json
{
  "chainId": 84532,
  "owner": "0x...",
  "relayer": "0x...",
  "platformOwner": "0x...",
  "inviteSigner": "0x..."
}
```

They are not secrets — only private keys are — and keeping them in a
chainId-validated file means **switching networks requires changing no
address in `.env`**. Foundry auto-loads a single `contracts/.env` and has no
`--env-file` flag, so when these addresses lived there, changing network
meant editing them in place; missing one produced a successful deployment
with the wrong configuration rather than an error. `relayer` can be rotated
afterwards, but `owner` is fixed at `initialize()` and cannot be, so that
mistake means redeploying.

A missing roles file is an error rather than a fallback to the environment —
recovering the old behaviour silently would defeat the point. There is
deliberately no `roles.base.json` until the mainnet addresses are settled;
a missing file failing loudly beats a placeholder that deploys stale values.

`HumanbasedRegistrarAdmin.s.sol` reads its target values from the same file,
which makes it the desired state and the script the thing that converges the
chain to it: edit the file, run the script, and the file stays equal to what
is on chain. Taking the new address from the environment instead would let
the file drift the moment anyone rotates.

#### Explorer verification

Add `--verify` to any deploy script to submit sources to Basescan as part of
the same run, with `BASESCAN_API_KEY` in the environment:

```shell
BASESCAN_API_KEY=<key> DEPLOYER_PRIVATE_KEY=<key> \
  forge script script/DIDRegistry.s.sol:DIDRegistryScript \
  --rpc-url base --broadcast --verify
```

`foundry.toml`'s `[etherscan]` section maps both `base` (8453) and
`base_sepolia` (84532) to that variable. Verifying at deploy time is easier
than after the fact — a later `forge verify-contract` has to be given the
compiler version and constructor arguments by hand.

#### Admin rotations

`HumanbasedRegistrarAdmin.s.sol` rotates the two `onlyOwner` addresses on an
already-deployed `HumanbasedRegistrar`. It reads the contract address from
`deployment.<network>.json` and requires `DEPLOYER_PRIVATE_KEY` to be that
contract's owner — a wrong key is rejected locally, before broadcasting.
Setting a value to what it already is exits as a no-op.

```shell
forge script script/HumanbasedRegistrarAdmin.s.sol:HumanbasedRegistrarAdminScript \
  --sig 'setRelayer()' --rpc-url <url> --broadcast        # target: roles.relayer

forge script script/HumanbasedRegistrarAdmin.s.sol:HumanbasedRegistrarAdminScript \
  --sig 'setPlatformOwner()' --rpc-url <url> --broadcast  # target: roles.platformOwner
```

`relayer` is a single address, not a set, so rotating it is a hard cutover:
the old relayer's `register` calls start reverting `NotRelayer` the moment the
transaction lands. Point the backend at the new key first.

`setPlatformOwner` only affects subsequent registrations. Already-registered
DIDs keep their existing owner, and their claim path still runs through that
address; migrating them requires `transferOwner` signed by the current owner.

### Upgrade

```shell
bash upgrade.sh
```

### Contract Call

Enter the directory `script/`

```
cd script
```

#### Configuration

Copy `.env` from `.env.example`, edit `.env`

```
USER_PRIVATE_KEY='' # the private key of the user
```

#### Execute

Register a new DID

```
python register.py
```

Manage a DID

```
python manager.py -h
```

There are several commands available

```
  {doc,owned,owner,add,transfer}
    doc                 Get the document of a did
    owned               Get the dids owned by an account
    owner               Get the owner of a did
    add                 Add a registrar
    transfer            Transfer owner
    additem             Add item to array attribute
    revokeitem          Revoke item from array attribute
    addauth             Add authentication
    revokeauth          Revoke authentication
    impl                Get implementation contract address
```