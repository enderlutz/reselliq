"""Agent token validation. Long-lived bearer token shared between cloud + agent.

Set AGENT_TOKEN in the cloud env (and the same value in the agent's env) to
authenticate /api/agent/* requests. Returns 401 if missing or wrong.
"""

from fastapi import Header, HTTPException, status

from ..config import settings


def require_agent_token(authorization: str = Header(None, alias="Authorization")) -> bool:
    if not settings.agent_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent endpoint disabled — AGENT_TOKEN not configured on server",
        )
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing agent bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    if token != settings.agent_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid agent token",
        )
    return True
