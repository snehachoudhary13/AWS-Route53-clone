from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select, func
from datetime import datetime

from app.database import get_session
from app.models import User, DNSRecord, HostedZone
from app.schemas import (
    DNSRecordCreate,
    DNSRecordUpdate,
    DNSRecordResponse,
    DNSRecordListResponse,
)
from app.auth import get_current_user

router = APIRouter()


@router.get("/hosted-zones/{zone_id}/records", response_model=DNSRecordListResponse)
async def get_records(
    zone_id: int,
    search: Optional[str] = None,
    type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List DNS records in a hosted zone with search, type filter, and pagination."""
    zone = session.get(HostedZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

    query = select(DNSRecord).where(DNSRecord.zone_id == zone_id)

    if search:
        query = query.where(
            (DNSRecord.name.ilike(f"%{search}%"))
            | (DNSRecord.value.ilike(f"%{search}%"))
        )

    if type:
        query = query.where(DNSRecord.type == type)

    total = session.exec(select(func.count()).select_from(query.subquery())).one()

    offset = (page - 1) * limit
    records = session.exec(query.offset(offset).limit(limit)).all()
    records_response = [DNSRecordResponse.model_validate(r) for r in records]

    return DNSRecordListResponse(
        records=records_response, total=total, page=page, limit=limit
    )


@router.post(
    "/hosted-zones/{zone_id}/records",
    response_model=DNSRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_record(
    zone_id: int,
    record_in: DNSRecordCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new DNS record in the specified hosted zone."""
    zone = session.get(HostedZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

    # Ensure name format
    name = record_in.name
    if name != "@" and not name.endswith("."):
        if not name.endswith(zone.name):
            name = f"{name}.{zone.name}"
        else:
            name += "."
    if name == "@":
        name = zone.name

    record_data = record_in.model_dump()
    record_data["name"] = name

    record = DNSRecord(**record_data, zone_id=zone.id)
    session.add(record)
    session.commit()
    session.refresh(record)

    return record


@router.put(
    "/hosted-zones/{zone_id}/records/{record_id}",
    response_model=DNSRecordResponse,
)
async def update_record(
    zone_id: int,
    record_id: int,
    record_update: DNSRecordUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update an existing DNS record."""
    zone = session.get(HostedZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

    record = session.get(DNSRecord, record_id)
    if not record or record.zone_id != zone_id:
        raise HTTPException(status_code=404, detail="DNS record not found")

    update_data = record_update.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        name = update_data["name"]
        if name != "@" and not name.endswith("."):
            if not name.endswith(zone.name):
                name = f"{name}.{zone.name}"
            else:
                name += "."
        if name == "@":
            name = zone.name
        update_data["name"] = name

    for key, value in update_data.items():
        setattr(record, key, value)

    record.updated_at = datetime.utcnow()
    session.add(record)
    session.commit()
    session.refresh(record)

    return record


@router.delete("/hosted-zones/{zone_id}/records/{record_id}")
async def delete_record(
    zone_id: int,
    record_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a specific DNS record."""
    zone = session.get(HostedZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

    record = session.get(DNSRecord, record_id)
    if not record or record.zone_id != zone_id:
        raise HTTPException(status_code=404, detail="DNS record not found")

    session.delete(record)
    session.commit()
    return {"message": "DNS record deleted successfully"}
