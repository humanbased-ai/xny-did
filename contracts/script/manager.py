import os
import json
from web3 import Web3
from web3.exceptions import ContractCustomError
from eth_abi import encode, decode
from dotenv import load_dotenv
from pathlib import Path
from web3.middleware import ExtraDataToPOAMiddleware
import argparse
import sys

# Read ABI file
current_dir = Path(__file__).parent
abi_path = current_dir / "DIDRegistry.json"
with abi_path.open("r", encoding="utf-8") as file:
    abi = json.load(file)

# Read contract address
deployment_path = current_dir / "deploymentRegistry.json"
with deployment_path.open("r", encoding="utf-8") as file:
    contract_address = json.load(file)["proxy"]

# Load .env file
load_dotenv()

# Read environment variables
private_key = os.getenv("OWNER_PRIVATE_KEY")
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

def parse_contract_custom_error(contract, error_data):
    """专门解析 ContractCustomError"""
    
    # 1. 构建错误映射表
    error_map = {}
    for item in contract.abi:
        if item['type'] == 'error':
            name = item['name']
            inputs = [inp['type'] for inp in item.get('inputs', [])]
            signature = f"{name}({','.join(inputs)})"
            selector = Web3.keccak(text=signature).hex()[:8]  # 前4字节
            
            error_map[selector] = {
                'name': name,
                'inputs': inputs,
                'signature': signature
            }
            print(f"📝 注册错误: {name} -> {selector}")
    
    # 2. 提取选择器
    if isinstance(error_data, str) and error_data.startswith('0x'):
        selector = error_data[2:10]
        param_data = error_data[10:]
    else:
        print(f"❌ 无效的错误数据格式: {error_data}")
        return None
    
    # 3. 匹配错误
    if selector in error_map:
        error_info = error_map[selector]
        print(f"🎯 识别到 Custom Error: {error_info['name']}")
        print(f"📋 错误签名: {error_info['signature']}")
        
        # 4. 解码参数
        if param_data and len(param_data) > 2:  # 去掉 0x 后还有数据
            try:
                param_bytes = bytes.fromhex(param_data[:])  # 去掉 0x
                decoded_params = decode(error_info['inputs'], param_bytes)
                print(f"📊 解码参数: {decoded_params}")
                
                return {
                    'name': error_info['name'],
                    'signature': error_info['signature'],
                    'parameters': decoded_params,
                    'selector': selector
                }
                
            except Exception as decode_error:
                print(f"❌ 参数解码失败: {decode_error}")
                return {
                    'name': error_info['name'],
                    'signature': error_info['signature'],
                    'parameters': [],
                    'selector': selector,
                    'decode_error': str(decode_error)
                }
        else:
            print("ℹ️ 该错误没有参数")
            return {
                'name': error_info['name'],
                'signature': error_info['signature'],
                'parameters': [],
                'selector': selector
            }
    else:
        print(f"❓ 未知错误选择器: {selector}")
        print(f"📦 原始数据: {error_data}")
        return None

def sendTransaction(funcName, *args):
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

    # Submit multiple at once, around 10 at most.
    try:
        tx = contract.functions[funcName](*args).build_transaction({
            "from": submitter.address,
            "nonce": nonce,
            "maxPriorityFeePerGas": max_priority_fee_per_gas,
            "maxFeePerGas": max_fee_per_gas,
            "chainId": web3.eth.chain_id,
            "type": 2,
        })

    except ContractCustomError as e:
        print("🎯 成功捕获到 ContractCustomError!")
        print("=" * 50)
        
        # 这个异常专门为 Custom Error 设计，包含完整信息
        print(f"📦 异常信息: {e}")
        print(f"🔧 异常参数: {e.args}")
        
        # ContractCustomError 直接包含错误数据
        if e.args and len(e.args) > 0:
            error_data = e.args[0]
            print(f"📄 错误数据: {error_data}")
            
            # 解析 Custom Error
            parse_contract_custom_error(contract, error_data)
        
        print("=" * 50)
        sys.exit()

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

def addItemToAttribute(args):
    print(f"👋 Hello, {args.name}!")

def getDidDocument(args):
    doc = contract.functions.getDidDocument(args.did).call()
    print(args.did, doc)

def getOwnedDids(args):
    owner = contract.functions.getOwnedDids(args.account).call()
    print(args.account, owner)

def ownerOf(args):
    owner = contract.functions.ownerOf(args.did).call()
    print(args.did, owner)

def implementation(args):
    # EIP-1967 implementation storage slot
    slot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"

    # 读取存储槽
    impl_hex = web3.eth.get_storage_at(contract_address, slot)

    # 获取最后 20 字节并转成地址
    impl_address = Web3.to_checksum_address(impl_hex[-20:])
    print(impl_address)

def addRegistrar(args):
    sendTransaction("updateRegistrars", [args.registrar], [])

def addItemToArrayAttribute(args):
    bytes_value = args.value.encode("utf-8")
    sendTransaction("addItemToAttribute", args.did, args.operator, args.name, bytes_value)

def revokeItemFromArrayAttribute(args):
    sendTransaction("revokeItemFromAttribute", args.did, args.operator, args.name, args.index)

def addAuthentication(args):
    bytes_value = args.value.encode("utf-8")
    sendTransaction("addAuthentication", args.did, args.operator, bytes_value)

def revokeAuthentication(args):
    bytes_value = args.value.encode("utf-8")
    sendTransaction("revokeAuthentication", args.did, args.operator, bytes_value)

def transferOwner(args):
    sendTransaction("transferOwner", args.did, args.owner)

def main():
    parser = argparse.ArgumentParser(
        description="A simple multi-command CLI tool"
    )
    subparsers = parser.add_subparsers(
        title="commands",
        description="Available commands",
        dest="command"
    )

    # ===== getDidDocument command =====
    parser_greet = subparsers.add_parser("doc", help="Get the document of a did")
    parser_greet.add_argument("--did", "-d", type=int, required=True, help="Did identifier")
    parser_greet.set_defaults(func=getDidDocument)

    # ===== getOwnedDids command =====
    parser_add = subparsers.add_parser("owned", help="Get the dids owned by an account")
    parser_add.add_argument("--account", "-a", required=True, help="Account address")
    parser_add.set_defaults(func=getOwnedDids)

    # ===== ownerOf command =====
    parser_echo = subparsers.add_parser("owner", help="Get the owner of a did")
    parser_echo.add_argument("--did", "-d", type=int, required=True, help="Did identifier")
    parser_echo.set_defaults(func=ownerOf)

    # ===== addRegistrar command =====
    parser_echo = subparsers.add_parser("add", help="Add a registrar")
    parser_echo.add_argument("--registrar", "-r", required=True, help="Registrar contract address")
    parser_echo.set_defaults(func=addRegistrar)

    # ===== transferOwner command =====
    parser_echo = subparsers.add_parser("transfer", help="Transfer owner")
    parser_echo.add_argument("--did", "-d", type=int, required=True, help="Did identifier")
    parser_echo.add_argument("--owner", "-o", required=True, help="Did owner")
    parser_echo.set_defaults(func=transferOwner)

    # ===== Add item to array attribute =====
    parser_echo = subparsers.add_parser("additem", help="Add item to array attribute")
    parser_echo.add_argument("--did", "-d", type=int, required=True, help="Did identifier")
    parser_echo.add_argument("--operator", "-o", type=int, required=True, help="operator did identifier")
    parser_echo.add_argument("--name", "-n", required=True, help="Attribute name")
    parser_echo.add_argument("--value", "-v", type=str, required=True, help="Attribute value")
    parser_echo.set_defaults(func=addItemToArrayAttribute)

    # ===== Revoke item from array attribute =====
    parser_echo = subparsers.add_parser("revokeitem", help="Revoke item from array attribute")
    parser_echo.add_argument("--did", "-d", type=int, required=True, help="Did identifier")
    parser_echo.add_argument("--operator", "-o", type=int, required=True, help="operator did identifier")
    parser_echo.add_argument("--name", "-n", required=True, help="Attribute name")
    parser_echo.add_argument("--index", "-i", type=int, required=True, help="Attribute index")
    parser_echo.set_defaults(func=revokeItemFromArrayAttribute)

    # ===== Add authentication =====
    parser_echo = subparsers.add_parser("addauth", help="Add authentication")
    parser_echo.add_argument("--did", "-d", type=int, required=True, help="Did identifier")
    parser_echo.add_argument("--operator", "-o", type=int, required=True, help="operator did identifier")
    parser_echo.add_argument("--value", "-v", type=str, required=True, help="Authentication value")
    parser_echo.set_defaults(func=addAuthentication)

    # ===== Revoke authentication =====
    parser_echo = subparsers.add_parser("revokeauth", help="Revoke authentication")
    parser_echo.add_argument("--did", "-d", type=int, required=True, help="Did identifier")
    parser_echo.add_argument("--operator", "-o", type=int, required=True, help="operator did identifier")
    parser_echo.add_argument("--value", "-v", type=str, required=True, help="Authentication value")
    parser_echo.set_defaults(func=revokeAuthentication)

    # ===== get implementation contract address =====
    parser_echo = subparsers.add_parser("impl", help="Get implementation contract address")
    parser_echo.set_defaults(func=implementation)

    # ===== parse & dispatch =====
    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()