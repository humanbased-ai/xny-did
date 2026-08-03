import os
import json
import rfc8785
from web3 import Web3
from eth_abi import encode
from dotenv import load_dotenv
from pathlib import Path
import time
from web3.middleware import ExtraDataToPOAMiddleware

import deployment as deployment_lib

# Read ABI file
current_dir = Path(__file__).parent
abi_path = current_dir / "DIDRegistrar.json"
with abi_path.open("r", encoding="utf-8") as file:
    abi = json.load(file)

# Load .env file
load_dotenv()

# Read environment variables
private_key = os.getenv("USER_PRIVATE_KEY")
rpc_url = deployment_lib.rpc_url()

print("rpc_url", rpc_url)

# Check if the environment variables are set
assert private_key and rpc_url, "check your .env file"

# connect to the blockchain network
web3 = Web3(Web3.HTTPProvider(rpc_url))

# Resolve addresses for whichever chain the RPC is on — after connecting, since
# the deployment file is selected by chain id and validated against it.
deployment = deployment_lib.load_deployment(web3)
contract_address = deployment_lib.require_address(deployment, "registrar")
print("chain_id", web3.eth.chain_id)
print("contract_address", contract_address)

# create a contract instance
contract = web3.eth.contract(address=contract_address, abi=abi)
web3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

# get address nonce
submitter = web3.eth.account.from_key(private_key)
nonce = web3.eth.get_transaction_count(submitter.address)

# get gas price
latest_block = web3.eth.get_block("latest")
base_fee_per_gas = latest_block["baseFeePerGas"]
fee_history = web3.eth.fee_history(1, "latest", [10])
priority_fees = fee_history["reward"][0]
max_priority_fee_per_gas = int(sum(priority_fees) / len(priority_fees))
max_fee_per_gas = base_fee_per_gas + max_priority_fee_per_gas * 2


# Simulated data
data = {
    "type": "EmailChallenge",
    "emailAddress": "myemail@email.com"
}
json_str = json.dumps(data)
json_bytes = json_str.encode("utf-8")

# Submit multiple at once, around 10 at most.
tx = contract.functions.registerWithAuthorization([json_bytes]).build_transaction({
    "from": submitter.address,
    "nonce": nonce,
    "maxPriorityFeePerGas": max_priority_fee_per_gas,
    "maxFeePerGas": max_fee_per_gas,
    "chainId": web3.eth.chain_id,
    "type": 2,
})

# estimate gas
tx["gas"] = web3.eth.estimate_gas(tx)
signed_tx = web3.eth.account.sign_transaction(tx, private_key)
tx_hash = web3.eth.send_raw_transaction(signed_tx.raw_transaction)
receipt = web3.eth.wait_for_transaction_receipt(tx_hash)

if receipt.status == 1:
    print("✅ Transaction executed successfully.")
else:
    print("❌ Transaction failed.（reverted）")
print(
    f"tx hash: {tx_hash.hex()}, block number: {receipt.blockNumber}, gas used: {receipt.gasUsed}"
)


def get_event(event_name, receipt):
    # Events are emitted by the registry, not the registrar, so this needs the
    # registry ABI and address. Both come from the already-loaded deployment and
    # the existing connection — re-reading the file and re-connecting here would
    # risk resolving against a different chain than the transaction was sent to.
    abi_path = current_dir / "DIDRegistry.json"
    with abi_path.open("r", encoding="utf-8") as file:
        registry_abi = json.load(file)

    registry_address = deployment_lib.require_address(deployment, "registryProxy")
    contract = web3.eth.contract(address=registry_address, abi=registry_abi)

    events = contract.events[event_name]().process_receipt(receipt)

    for e in events:
        # DIDRegistered carries (identifier, owner) only — printing args covers
        # both. An earlier `e['args']['data']` here always raised KeyError, so
        # this function had never run to completion.
        print("Event args:", e['args'])

get_event("DIDRegistered", receipt)