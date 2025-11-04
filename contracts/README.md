# Coddata DID

This repository provides the Solidity-based EVM implementation of the did:codatta method.
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
```