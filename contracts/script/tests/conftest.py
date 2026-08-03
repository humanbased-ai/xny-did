"""Make the script/ modules importable from the tests directory."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
