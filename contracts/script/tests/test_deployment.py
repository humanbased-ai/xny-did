"""Tests for the per-network deployment loader.

The point of these is the cross-chain guard: `load_deployment` must refuse when a
deployment file belongs to a different chain than the RPC is connected to. The
failure mode it prevents — operating on one chain with another chain's contract
addresses — is silent, so the cases where validation might *quietly not happen*
(a quoted chainId, a missing one, a malformed one) are pinned down explicitly.

`_CONFIG_DIR` is monkeypatched to a tmp_path so no test reads or writes the real
config files.
"""

import json

import pytest

import deployment as deployment_lib


class _FakeEth:
    def __init__(self, chain_id):
        self.chain_id = chain_id


class FakeWeb3:
    """Stands in for a connected Web3. load_deployment only reads eth.chain_id."""

    def __init__(self, chain_id):
        self.eth = _FakeEth(chain_id)


@pytest.fixture
def config_dir(tmp_path, monkeypatch):
    """Redirect the loader at a scratch directory."""
    monkeypatch.setattr(deployment_lib, "_CONFIG_DIR", tmp_path)
    return tmp_path


def write_networks(config_dir, mapping):
    (config_dir / "networks.json").write_text(json.dumps(mapping), encoding="utf-8")


def write_deployment(config_dir, name, record):
    path = config_dir / f"deployment.{name}.json"
    path.write_text(json.dumps(record), encoding="utf-8")
    return path


# --- network_name -----------------------------------------------------------


def test_network_name_uses_the_map(config_dir):
    write_networks(config_dir, {"8453": "base", "84532": "base_sepolia"})
    assert deployment_lib.network_name(8453) == "base"
    assert deployment_lib.network_name(84532) == "base_sepolia"


def test_network_name_falls_back_to_decimal_when_unmapped(config_dir):
    write_networks(config_dir, {"8453": "base"})
    # A chain nobody has added an entry for still resolves, so deploying to a new
    # network needs no configuration.
    assert deployment_lib.network_name(31338) == "31338"


def test_network_name_falls_back_when_map_is_absent(config_dir):
    assert deployment_lib.network_name(8453) == "8453"


def test_deployment_path_is_derived_from_the_name(config_dir):
    write_networks(config_dir, {"84532": "base_sepolia"})
    assert (
        deployment_lib.deployment_path(84532).name == "deployment.base_sepolia.json"
    )


# --- load_deployment: happy path -------------------------------------------


def test_load_returns_the_record_for_the_connected_chain(config_dir):
    write_networks(config_dir, {"84532": "base_sepolia"})
    write_deployment(
        config_dir,
        "base_sepolia",
        {"chainId": 84532, "registryProxy": "0xabc"},
    )
    record = deployment_lib.load_deployment(FakeWeb3(84532))
    assert record["registryProxy"] == "0xabc"


def test_load_uses_the_numeric_filename_for_an_unmapped_chain(config_dir):
    write_deployment(config_dir, "31338", {"chainId": 31338, "registryProxy": "0xdef"})
    record = deployment_lib.load_deployment(FakeWeb3(31338))
    assert record["registryProxy"] == "0xdef"


# --- load_deployment: the guard --------------------------------------------


def test_load_raises_when_no_record_exists_for_the_chain(config_dir):
    write_networks(config_dir, {"8453": "base"})
    with pytest.raises(FileNotFoundError) as excinfo:
        deployment_lib.load_deployment(FakeWeb3(8453))
    # The message has to name the chain and the file, or the operator cannot tell
    # whether the RPC or the records are wrong.
    assert "8453" in str(excinfo.value)
    assert "deployment.base.json" in str(excinfo.value)


def test_load_rejects_a_record_from_a_different_chain(config_dir):
    write_networks(config_dir, {"84532": "base_sepolia"})
    write_deployment(
        config_dir,
        "base_sepolia",
        {"chainId": 8453, "registryProxy": "0xabc"},
    )
    with pytest.raises(deployment_lib.ChainIdMismatch) as excinfo:
        deployment_lib.load_deployment(FakeWeb3(84532))
    assert "8453" in str(excinfo.value)
    assert "84532" in str(excinfo.value)


def test_load_still_validates_a_quoted_chain_id(config_dir):
    """A hand-edited "8453" must be caught, not skipped as unparsable."""
    write_networks(config_dir, {"84532": "base_sepolia"})
    write_deployment(
        config_dir,
        "base_sepolia",
        {"chainId": "8453", "registryProxy": "0xabc"},
    )
    with pytest.raises(deployment_lib.ChainIdMismatch):
        deployment_lib.load_deployment(FakeWeb3(84532))


def test_load_accepts_a_matching_quoted_chain_id(config_dir):
    write_networks(config_dir, {"84532": "base_sepolia"})
    write_deployment(
        config_dir,
        "base_sepolia",
        {"chainId": "84532", "registryProxy": "0xabc"},
    )
    assert deployment_lib.load_deployment(FakeWeb3(84532))["registryProxy"] == "0xabc"


def test_load_raises_on_a_non_numeric_chain_id(config_dir):
    """Malformed must fail loudly — swallowing it disables the check silently."""
    write_networks(config_dir, {"84532": "base_sepolia"})
    write_deployment(
        config_dir,
        "base_sepolia",
        {"chainId": "base_sepolia", "registryProxy": "0xabc"},
    )
    with pytest.raises(ValueError):
        deployment_lib.load_deployment(FakeWeb3(84532))


def test_load_accepts_a_record_without_a_chain_id(config_dir):
    """Files predating the field are read as-is rather than rejected."""
    write_networks(config_dir, {"84532": "base_sepolia"})
    write_deployment(config_dir, "base_sepolia", {"registryProxy": "0xabc"})
    assert deployment_lib.load_deployment(FakeWeb3(84532))["registryProxy"] == "0xabc"


# --- require_address --------------------------------------------------------


def test_require_address_returns_the_address():
    assert deployment_lib.require_address({"registrar": "0xabc"}, "registrar") == "0xabc"


@pytest.mark.parametrize("record", [{}, {"registrar": None}, {"registrar": ""}])
def test_require_address_raises_when_absent_or_empty(record):
    with pytest.raises(KeyError):
        deployment_lib.require_address(record, "registrar")


def test_require_address_error_names_the_key_and_chain():
    with pytest.raises(KeyError) as excinfo:
        deployment_lib.require_address({"chainId": 8453}, "humanbasedRegistrar")
    message = str(excinfo.value)
    assert "humanbasedRegistrar" in message
    assert "8453" in message


# --- rpc_url ----------------------------------------------------------------


def test_rpc_url_prefers_the_neutral_variable(monkeypatch):
    monkeypatch.setenv("RPC_URL", "https://primary")
    monkeypatch.setenv("KITE_TEST_PRC_URL", "https://legacy")
    assert deployment_lib.rpc_url() == "https://primary"


def test_rpc_url_falls_back_to_the_legacy_variable(monkeypatch):
    monkeypatch.delenv("RPC_URL", raising=False)
    monkeypatch.setenv("KITE_TEST_PRC_URL", "https://legacy")
    assert deployment_lib.rpc_url() == "https://legacy"


def test_rpc_url_is_none_when_unset(monkeypatch):
    monkeypatch.delenv("RPC_URL", raising=False)
    monkeypatch.delenv("KITE_TEST_PRC_URL", raising=False)
    assert deployment_lib.rpc_url() is None
