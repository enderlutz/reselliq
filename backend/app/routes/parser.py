from fastapi import APIRouter, Depends

from ..models import User
from ..schemas import ParseLinkRequest, ParseLinkResponse
from ..services.auth import get_current_user
from ..services.link_parser import parse_link

router = APIRouter(prefix="/api/parser", tags=["parser"])


@router.post("/link", response_model=ParseLinkResponse)
async def parse(payload: ParseLinkRequest, _: User = Depends(get_current_user)):
    result = await parse_link(payload.url)
    return ParseLinkResponse(**result)
