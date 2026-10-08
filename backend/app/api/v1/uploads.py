from fastapi import APIRouter, HTTPException

router = APIRouter(prefix='/uploads', tags=['uploads'])


@router.post('')
async def upload_placeholder():
    raise HTTPException(status_code=501, detail='Uploads are not configured')
