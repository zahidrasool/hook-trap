"""Test sending email to a sandbox WITHOUT authentication (like Gmail would)."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

msg = MIMEMultipart("alternative")
msg["From"] = "John Doe <john@gmail.com>"
msg["To"] = "test1@inbox.hooktrap.dev"
msg["Subject"] = "Hey from Gmail!"

text_body = "This email was sent without SMTP auth, just like Gmail would send it."
html_body = (
    "<html><body>"
    '<h2 style="color: #333;">Hello from Gmail!</h2>'
    "<p>This email was sent <strong>without SMTP authentication</strong>, "
    "simulating how Gmail or any external email provider would deliver mail.</p>"
    "<p>If you see this in your sandbox inbox, public email receiving works!</p>"
    "</body></html>"
)

msg.attach(MIMEText(text_body, "plain"))
msg.attach(MIMEText(html_body, "html"))

# Connect WITHOUT login — just like Gmail/external senders
server = smtplib.SMTP("127.0.0.1", 2525)
server.set_debuglevel(1)  # Show SMTP conversation
server.sendmail("john@gmail.com", ["test1@inbox.hooktrap.dev"], msg.as_string())
print("\nEmail sent successfully WITHOUT auth!")
server.quit()
