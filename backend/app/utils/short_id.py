import string
import secrets


def generate_short_id(length: int = 10) -> str:
    """Generate a random short ID: mix of lowercase letters and numbers."""
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_workspace_short_id() -> str:
    """Generate human-readable workspace ID like 'abc-xyz'."""
    part1 = "".join(secrets.choice(string.ascii_lowercase) for _ in range(3))
    part2 = "".join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(3))
    return f"{part1}-{part2}"
