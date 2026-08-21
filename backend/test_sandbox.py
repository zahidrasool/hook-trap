"""Send a test email to a sandbox inbox."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Get sandbox credentials from DB
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

e = create_engine("postgresql://postgres:postgres@localhost:5432/hooktrap")
with Session(e) as s:
    row = s.execute(
        text("SELECT smtp_username, smtp_password, email_address FROM sandboxes WHERE email_prefix = 'test1'")
    ).fetchone()
e.dispose()

if not row:
    print("No sandbox found with prefix 'test1'")
    exit(1)

username, password, email_addr = row[0], row[1], row[2]
print(f"Sandbox: {email_addr}")
print(f"SMTP: {username} / {password}")

# Build email
msg = MIMEMultipart("alternative")
msg["From"] = "Signup Bot <signup@myapp.com>"
msg["To"] = email_addr
msg["Subject"] = "Welcome to MyApp!"

text_body = "Hello! Thanks for signing up to MyApp."
html_body = (
    "<html><body>"
    '<h1 style="color: #4f46e5;">Welcome to MyApp!</h1>'
    "<p>Thanks for signing up. Click below to verify your email:</p>"
    '<a href="https://myapp.com/verify?token=abc123" '
    'style="background:#4f46e5;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">'
    "Verify Email</a>"
    "</body></html>"
)

msg.attach(MIMEText(text_body, "plain"))
msg.attach(MIMEText(html_body, "html"))

# Send via SMTP
server = smtplib.SMTP("127.0.0.1", 2525)
server.login(username, password)
server.sendmail("signup@myapp.com", [email_addr], msg.as_string())
server.quit()
print("Email sent successfully!")
