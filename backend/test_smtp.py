"""Quick test: send an email through the fake SMTP inbox."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

msg = MIMEMultipart("alternative")
msg["From"] = "Test User <test@example.com>"
msg["To"] = "customer@acme.com"
msg["Subject"] = "Welcome to MockLane - Test Email"

text_body = "Hello! This is a test email sent through MockLane fake SMTP inbox."
html_body = (
    "<html><body>"
    '<h1 style="color: #4f46e5;">Welcome to MockLane!</h1>'
    "<p>This is a <strong>test email</strong> sent through the fake SMTP inbox.</p>"
    "<p>All emails are captured safely - no real customers were harmed!</p>"
    "</body></html>"
)

msg.attach(MIMEText(text_body, "plain"))
msg.attach(MIMEText(html_body, "html"))

# Get password from DB to avoid font rendering confusion
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
e = create_engine("postgresql://postgres:postgres@localhost:5432/mocklane")
with Session(e) as s:
    row = s.execute(
        text("SELECT smtp_username, smtp_password FROM workspaces WHERE smtp_username = 'ws_elq-kc4'")
    ).fetchone()
e.dispose()

username = row[0]
password = row[1]
print(f"Using credentials: {username} / {password}")

server = smtplib.SMTP("127.0.0.1", 2525)
server.set_debuglevel(0)  # quiet mode
print("--- Logging in ---")
resp = server.login(username, password)
print(f"Login response: {resp}")
print("--- Sending email ---")
server.sendmail("test@example.com", ["customer@acme.com"], msg.as_string())
print("Email sent successfully!")
server.quit()
