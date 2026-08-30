import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

class EmailService:
    """
    A simple email service using standard SMTP (e.g., Gmail).
    To use this, set SMTP_EMAIL and SMTP_PASSWORD in your Render environment variables.
    (For Gmail, you must use an 'App Password', not your main password).
    """
    
    @staticmethod
    def send_upgrade_email(user_email: str, plan_name: str):
        sender_email = os.getenv("SMTP_EMAIL")
        sender_password = os.getenv("SMTP_PASSWORD")
        
        if not sender_email or not sender_password:
            print("Email credentials not configured. Skipping email notification.")
            return False
            
        subject = f"Welcome to UniConv {plan_name}!"
        body = f"""
        <html>
            <body>
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; border-radius: 10px;">
                    <h2 style="color: #4f46e5;">You have been upgraded! 🚀</h2>
                    <p style="font-size: 16px; color: #333;">Hello,</p>
                    <p style="font-size: 16px; color: #333;">Your account has been successfully upgraded to the <strong>{plan_name}</strong> plan.</p>
                    <p style="font-size: 16px; color: #333;">You now have access to higher file size limits and premium features. Thank you for using UniConv!</p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #888;">If you did not request this change, please contact our support team.</p>
                </div>
            </body>
        </html>
        """
        
        message = MIMEMultipart()
        message["From"] = f"UniConv Support <{sender_email}>"
        message["To"] = user_email
        message["Subject"] = subject
        message.attach(MIMEText(body, "html"))
        
        try:
            # Using Gmail's SMTP server as default
            server = smtplib.SMTP("smtp.gmail.com", 587)
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(message)
            server.quit()
            print(f"Upgrade email sent successfully to {user_email}")
            return True
        except Exception as e:
            print(f"Failed to send email: {e}")
            return False
