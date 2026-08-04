"""Per-network deployment loading, shared by the Python scripts.

Mirrors DeploymentLib.sol: the record lives in `config/deployment.<network>.json`,
where `<network>` comes from the connected chain id via `config/networks.json`, and
an unmapped chain id falls back to its decimal form.

The file's own `chainId` field — not the filename — is what gets validated, so a
renamed file or a numeric-fallback name cannot pair one network's addresses with
another network's RPC. Reads are lenient about a file with no `chainId` (those
predate the field) and strict about one that disagrees.
"""

import json
import os
from pathlib import Path

# Per-network config lives in its own directory: these are the only files under
# script/ whose count grows — two more per network — so they are kept apart from the
# scripts, ABIs and tooling. Mirrors _configDir() in DeploymentLib.sol.
_CONFIG_DIR = Path(__file__).parent / "config"

# Env var holding the RPC endpoint. KITE_TEST_PRC_URL (sic) is the historical
# name; it is still honoured so existing .env files keep working, but it names a
# network that no longer has a deployment record, hence the neutral primary.
_RPC_ENV_VARS = ("RPC_URL", "KITE_TEST_PRC_URL")


class ChainIdMismatch(Exception):
    """The deployment file belongs to a different chain than the RPC is on."""


def rpc_url():
    """The configured RPC endpoint, or None. Call load_dotenv() first."""
    for name in _RPC_ENV_VARS:
        value = os.getenv(name)
        if value:
            return value
    return None


def network_name(chain_id):
    """Readable name for a chain id, falling back to its decimal form."""
    key = str(chain_id)
    path = _CONFIG_DIR / "networks.json"
    if not path.exists():
        return key
    with path.open("r", encoding="utf-8") as file:
        return json.load(file).get(key, key)


def deployment_path(chain_id):
    return _CONFIG_DIR / f"deployment.{network_name(chain_id)}.json"


def load_deployment(web3):
    """Load the deployment record for the chain `web3` is connected to.

    Requires a live connection: the file is selected by `web3.eth.chain_id`, so
    call this after connecting, not at import time.
    """
    chain_id = web3.eth.chain_id
    path = deployment_path(chain_id)

    if not path.exists():
        raise FileNotFoundError(
            f"no deployment record for chain {chain_id} (looked for {path.name}). "
            f"Either the RPC points at a network that has not been deployed to, "
            f"or that network needs an entry in networks.json."
        )

    with path.open("r", encoding="utf-8") as file:
        deployment = json.load(file)

    recorded = deployment.get("chainId")
    # int() so a hand-edited "8453" validates the same as 8453, matching the
    # Solidity side's parseJsonUint. A non-numeric value raises, rather than
    # silently skipping the check on exactly the files that were hand-edited.
    if recorded is not None and int(recorded) != chain_id:
        raise ChainIdMismatch(
            f"{path.name} records chainId {recorded}, but the RPC is connected to "
            f"chain {chain_id}. Refusing to use one network's addresses on another."
        )

    return deployment


def require_address(deployment, key):
    """Fetch a contract address from a loaded record, or explain what is missing."""
    address = deployment.get(key)
    if not address:
        raise KeyError(
            f"'{key}' is missing from the deployment record for chain "
            f"{deployment.get('chainId', 'unknown')} — deploy it first."
        )
    return address
