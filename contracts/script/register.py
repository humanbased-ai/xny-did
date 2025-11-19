import os
import json
import rfc8785
from web3 import Web3
from eth_abi import encode
from dotenv import load_dotenv
from pathlib import Path
import time
from web3.middleware import ExtraDataToPOAMiddleware

# Read ABI file
current_dir = Path(__file__).parent
abi_path = current_dir / "DIDRegistrar.json"
with abi_path.open("r", encoding="utf-8") as file:
    abi = json.load(file)

# Read contract address
deployment_path = current_dir / "deploymentRegistrar.json"
with deployment_path.open("r", encoding="utf-8") as file:
    contract_address = json.load(file)["registrar"]

# Load .env file
load_dotenv()

# Read environment variables
private_key = os.getenv("USER_PRIVATE_KEY")
rpc_url = os.getenv("KITE_TEST_PRC_URL")

# print(private_key)
print("contract_address", contract_address)
print("rpc_url", rpc_url)

# Check if the environment variables are set
assert private_key and contract_address and rpc_url, "check your .env file"

# connect to the blockchain network
web3 = Web3(Web3.HTTPProvider(rpc_url))
# print("connected:", web3.is_connected())
# print("chain_id:", web3.eth.chain_id)

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
    # Read ABI file
    current_dir = Path(__file__).parent
    abi_path = current_dir / "DIDRegistry.json"
    with abi_path.open("r", encoding="utf-8") as file:
        abi = json.load(file)

    # Read contract address
    deployment_path = current_dir / "deploymentRegistry.json"
    with deployment_path.open("r", encoding="utf-8") as file:
        contract_address = json.load(file)["proxy"]

    # connect to the blockchain network
    web3 = Web3(Web3.HTTPProvider(rpc_url))

    # create a contract instance
    contract = web3.eth.contract(address=contract_address, abi=abi)

    events = contract.events[event_name]().process_receipt(receipt)

    for e in events:
        print("Event args:", e['args'])
        print("Stored data:", e['args']['data'])

get_event("DIDRegistered", receipt)