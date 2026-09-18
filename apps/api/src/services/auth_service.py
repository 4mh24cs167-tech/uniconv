"""
auth_service.py — Email/password authentication with OTP verification via Brevo SMTP.
Flow: signup → OTP email → verify → account created → login
"""
import os
import secrets
import string
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
from supabase import create_client, Client

supabase: Client = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_SERVICE_KEY", "")
)

# Brevo SMTP config
BREVO_SMTP_HOST = os.getenv("BREVO_SMTP_HOST", "smtp-relay.brevo.com")
BREVO_SMTP_PORT = int(os.getenv("BREVO_SMTP_PORT", "587"))
BREVO_SMTP_USER = os.getenv("BREVO_SMTP_USER", "")
BREVO_SMTP_PASS = os.getenv("BREVO_SMTP_PASS", "")
BREVO_FROM_EMAIL = os.getenv("BREVO_FROM_EMAIL", "noreply@uniconv.app")
BREVO_FROM_NAME = os.getenv("BREVO_FROM_NAME", "UniConv")

OTP_TTL_SECONDS = 600  # 10 minutes
# In-memory store: { email: { "otp": str, "name": str, "password": str, "created_at": float } }
_otp_store: dict = {}


def _generate_otp(length: int = 6) -> str:
    return ''.join(secrets.choice(string.digits) for _ in range(length))


def _send_email_brevo(to_email: str, subject: str, html_body: str, text_body: str = ""):
    """Send email via Brevo SMTP relay."""
    if not BREVO_SMTP_USER or not BREVO_SMTP_PASS:
        raise Exception("Email service not configured. Please contact support.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{BREVO_FROM_NAME} <{BREVO_FROM_EMAIL}>"
    msg["To"] = to_email

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(BREVO_SMTP_HOST, BREVO_SMTP_PORT) as server:
        server.starttls()
        server.login(BREVO_SMTP_USER, BREVO_SMTP_PASS)
        server.sendmail(BREVO_FROM_EMAIL, to_email, msg.as_string())


def _cleanup_expired():
    """Remove expired OTP entries."""
    now = time.time()
    expired = [email for email, data in _otp_store.items()
               if now - data["created_at"] > OTP_TTL_SECONDS]
    for email in expired:
        del _otp_store[email]


def signup_with_email(email: str, password: str, name: str = "") -> dict:
    """
    Step 1: Initiate signup. Sends a 6-digit OTP to the user's email.
    Returns: { "message": "...", "email": email }
    """
    _cleanup_expired()

    # Validate inputs
    if not email or not password:
        raise ValueError("Email and password are required")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters")
    if len(password) > 72:
        raise ValueError("Password must be at most 72 characters")
    if len(name) > 100:
        raise ValueError("Name must be at most 100 characters")

    # Check if user already exists
    existing = supabase.table("users").select("id").eq("email", email).execute()
    if existing.data:
        raise ValueError("An account with this email already exists")

    # Generate and store OTP
    otp = _generate_otp()
    _otp_store[email] = {
        "otp": otp,
        "name": name.strip(),
        "password": password,
        "created_at": time.time(),
    }

    # Send OTP email
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #e5322d; font-size: 28px;">UniConv</h1>
          <p style="color: #666;">Verify your email address</p>
        </div>
        <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; text-align: center;">
          <p style="color: #333; font-size: 16px;">Your verification code is:</p>
          <div style="background: #e5322d; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px; border-radius: 8px; margin: 20px 0;">
            {otp}
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't create an account, please ignore this email.</p>
        </div>
      </body>
    </html>
    """
    text_body = f"Your UniConv verification code is: {otp}\n\nThis code expires in 10 minutes.\nIf you didn't create an account, ignore this email."

    _send_email_brevo(
        to_email=email,
        subject="Verify your UniConv account",
        html_body=html_body,
        text_body=text_body,
    )

    return {"message": f"Verification code sent to {email}", "email": email}


def verify_otp(email: str, otp: str) -> dict:
    """
    Step 2: Verify OTP and create the user account.
    Returns: { "user": {...}, "session": {...} }
    """
    _cleanup_expired()

    if email not in _otp_store:
        raise ValueError("Verification code expired or not found. Please request a new one.")

    data = _otp_store[email]

    if data["otp"] != otp.strip():
        raise ValueError("Invalid verification code")

    # OTP is valid — create the user
    try:
        # Use Supabase Admin API to create user
        auth_response = supabase.auth.admin.create_user({
            "email": email,
            "password": data["password"],
            "email_confirm": True,  # Already verified via OTP
            "user_metadata": {
                "full_name": data.get("name", ""),
            }
        })

        user = auth_response.user
        if not user:
            raise Exception("Failed to create user account")

        # Create profile entry
        supabase.table("users").insert({
            "id": user.id,
            "email": email,
            "name": data.get("name", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

        # Generate session using Supabase Auth
        session_response = supabase.auth.admin.generate_link({
            "type": "magiclink",
            "email": email,
        })

        # For login, create a proper session
        login_resp = supabase.auth.sign_in_with_password({
            "email": email,
            "password": data["password"],
        })

        # Clear OTP
        del _otp_store[email]

        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": data.get("name", ""),
            },
            "session": {
                "access_token": login_resp.session.access_token,
                "refresh_token": login_resp.session.refresh_token,
                "expires_in": login_resp.session.expires_in,
            }
        }

    except Exception as e:
        del _otp_store[email]
        raise Exception(f"Account creation failed: {str(e)}")


def resend_otp(email: str) -> dict:
    """
    Resend OTP to email.
    """
    _cleanup_expired()

    if email not in _otp_store:
        raise ValueError("No pending verification found. Please sign up again.")

    # Generate new OTP
    otp = _generate_otp()
    _otp_store[email]["otp"] = otp
    _otp_store[email]["created_at"] = time.time()

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #e5322d; font-size: 28px;">UniConv</h1>
          <p style="color: #666;">Your new verification code</p>
        </div>
        <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; text-align: center;">
          <p style="color: #333; font-size: 16px;">Your verification code is:</p>
          <div style="background: #e5322d; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px; border-radius: 8px; margin: 20px 0;">
            {otp}
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
        </div>
      </body>
    </html>
    """
    text_body = f"Your UniConv verification code is: {otp}\n\nThis code expires in 10 minutes."

    _send_email_brevo(
        to_email=email,
        subject="Your new UniConv verification code",
        html_body=html_body,
        text_body=text_body,
    )

    return {"message": f"New verification code sent to {email}"}


def login_with_email(email: str, password: str) -> dict:
    """
    Login with email and password.
    Returns: { "user": {...}, "session": {...} }
    """
    try:
        login_resp = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password,
        })

        user = login_resp.user
        session = login_resp.session

        if not user:
            raise ValueError("Invalid email or password")

        # Ensure user exists in users table (handles users who signed up via Supabase directly)
        existing = supabase.table("users").select("id").eq("id", user.id).single().execute()
        if not existing.data:
            supabase.table("users").insert({
                "id": user.id,
                "email": user.email,
                "name": (user.user_metadata or {}).get("full_name", "") or (user.user_metadata or {}).get("name", ""),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()

        # Get profile info
        profile = supabase.table("users").select("name").eq("id", user.id).single().execute()
        full_name = profile.data.get("name", "") if profile.data else ""

        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": full_name,
            },
            "session": {
                "access_token": session.access_token,
                "refresh_token": session.refresh_token,
                "expires_in": session.expires_in,
            }
        }
    except Exception as e:
        error_msg = str(e)
        if "Invalid login credentials" in error_msg:
            raise ValueError("Invalid email or password")
        raise ValueError(f"Login failed: {error_msg}")
