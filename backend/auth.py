"""
Hadi Education System Balkassar — Authentication & RBAC Authorization Engine
Enforces server-side permissions for Owner, Admin, Accountant, Teacher, Staff, and Parent.
"""

import json
import hashlib
import secrets
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, g
try:
    from database import get_db
except ImportError:
    from backend.database import get_db

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def create_user_session(user_id: str, hours_valid: int = 72) -> str:
    token = secrets.token_hex(32)
    expires_at = (datetime.now() + timedelta(hours=hours_valid)).strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db()
    c = conn.cursor()
    c.execute("""
    INSERT INTO auth_tokens (token, user_id, expires_at)
    VALUES (?, ?, ?)
    """, (token, user_id, expires_at))
    conn.commit()
    conn.close()
    return token

def get_user_by_token(token: str):
    if not token:
        return None
    conn = get_db()
    c = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute("""
    SELECT u.id, u.username, u.role, u.full_name, u.email, u.phone, u.linked_student_ids, u.linked_staff_id, u.is_active
    FROM users u
    JOIN auth_tokens t ON u.id = t.user_id
    WHERE t.token = ? AND t.expires_at > ? AND u.is_active = 1
    """, (token, now_str))
    row = c.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def extract_token_from_request():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    if request.headers.get("X-Auth-Token"):
        return request.headers.get("X-Auth-Token").strip()
    return request.cookies.get("hes_token")

def require_auth(allowed_roles=None):
    """
    Decorator to protect API routes with role-based access control.
    allowed_roles: list of roles, e.g. ['owner', 'admin', 'accountant']
    If allowed_roles is None, any authenticated user is allowed.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            token = extract_token_from_request()
            if not token:
                return jsonify({"error": "Authentication token missing.", "code": "UNAUTHORIZED"}), 401
            
            user = get_user_by_token(token)
            if not user:
                return jsonify({"error": "Invalid or expired session token.", "code": "INVALID_TOKEN"}), 401
            
            if allowed_roles:
                # Owner always has super-admin rights
                if user["role"] != "owner" and user["role"] not in allowed_roles:
                    return jsonify({
                        "error": f"Access denied. Required roles: {allowed_roles}. Current role: {user['role']}",
                        "code": "FORBIDDEN"
                    }), 403
            
            g.current_user = user
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def log_activity(conn, actor_id, actor_role, action, entity_type, entity_id, details=None, ip_address=None):
    """Logs critical mutations into immutable audit trail."""
    try:
        c = conn.cursor()
        log_id = f"log_{secrets.token_hex(8)}"
        details_str = json.dumps(details, ensure_ascii=False) if details else None
        c.execute("""
        INSERT INTO activity_logs (id, actor_user_id, actor_role, action, entity_type, entity_id, details_json, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (log_id, actor_id, actor_role, action, entity_type, entity_id, details_str, ip_address))
    except Exception as e:
        print("Audit logging error:", e)
