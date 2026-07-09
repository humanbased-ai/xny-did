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

Each script reads prior contract addresses from `script/deployment.json`
and writes the new address back on success. Run with
`forge script script/<file>.s.sol:<Contract>Script --rpc-url <url> --broadcast`.

| Script | Env vars | Persists to `deployment.json` |
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