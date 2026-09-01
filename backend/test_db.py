"""Test sync DB lookup for SMTP credentials."""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

e = create_engine("postgresql://postgres:postgres@localhost:5432/mocklane")
with Session(e) as s:
    rows = s.execute(
        text("SELECT smtp_username, smtp_password FROM workspaces WHERE smtp_username = 'ws_elq-kc4'")
    ).fetchall()
    print(f"Found {len(rows)} rows:")
    for row in rows:
        print(f"  username={row[0]}, password={row[1]}")
e.dispose()
