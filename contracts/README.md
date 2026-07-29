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
`script/deployment.<network>.json` and writes the new address back on
success. Run with
`forge script script/<file>.s.sol:<Contract>Script --rpc-url <url> --broadcast`.

`<network>` is derived from the chain id of whatever `--rpc-url` points at,
using the map in `script/networks.json` (e.g. `84532` → `base_sepolia`). An
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

| Script | Env vars | Persists to `deployment.<network>.json` |
| --- | --- | --- |
| `DIDRegistry.s.sol` | `DEPLOYER_PRIVATE_KEY`, `OWNER` | `registryImpl`, `registryProxy` |
| `DIDRegistrar.s.sol` | `DEPLOYER_PRIVATE_KEY` | `registrar` |
| `InviteRegistrar.s.sol` | `DEPLOYER_PRIVATE_KEY`, `INVITE_SIGNER` | `inviteRegistrar` |
| `HumanbasedRegistrar.s.sol` | `DEPLOYER_PRIVATE_KEY`, `RELAYER_ADDRESS`, `PLATFORM_OWNER_ADDRESS` | `humanbasedRegistrar` |
| `Upgrade.s.sol` | `DEPLOYER_PRIVATE_KEY` | (no new addresses; upgrades the proxy in place) |

All scripts require `DEPLOYER_PRIVATE_KEY`. `OWNER` / `INVITE_SIGNER` /
`RELAYER_ADDRESS` / `PLATFORM_OWNER_ADDRESS` are role-specific addresses
that must be distinct from the deployer. The deployer account pays gas
and (for `HumanbasedRegistrar.s.sol`) becomes the contract's
admin / Ownable owner.

#### Admin rotations

`HumanbasedRegistrarAdmin.s.sol` rotates the two `onlyOwner` addresses on an
already-deployed `HumanbasedRegistrar`. It reads the contract address from
`deployment.<network>.json` and requires `DEPLOYER_PRIVATE_KEY` to be that
contract's owner — a wrong key is rejected locally, before broadcasting.
Setting a value to what it already is exits as a no-op.

```shell
forge script script/HumanbasedRegistrarAdmin.s.sol:HumanbasedRegistrarAdminScript \
  --sig 'setRelayer()' --rpc-url <url> --broadcast        # reads RELAYER_ADDRESS

forge script script/HumanbasedRegistrarAdmin.s.sol:HumanbasedRegistrarAdminScript \
  --sig 'setPlatformOwner()' --rpc-url <url> --broadcast  # reads PLATFORM_OWNER_ADDRESS
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