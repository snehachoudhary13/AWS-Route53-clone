from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select, func
from datetime import datetime

from app.database import get_session
from app.models import User, HostedZone, DNSRecord
from app.schemas import (
    HostedZoneCreate,
    HostedZoneUpdate,
    HostedZoneResponse,
    HostedZoneListResponse,
)
from app.auth import get_current_user

router = APIRouter()


@router.get("/hosted-zones", response_model=HostedZoneListResponse)
async def get_zones(
    search: Optional[str] = None,
    type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List hosted zones with search filter and pagination."""
    query = select(HostedZone)
    if search:
        query = query.where(
            (HostedZone.name.ilike(f"%{search}%"))
            | (HostedZone.comment.ilike(f"%{search}%"))
        )
    if type:
        query = query.where(HostedZone.type == type)

    total = session.exec(select(func.count()).select_from(query.subquery())).one()

    offset = (page - 1) * limit
    zones_result = session.exec(query.offset(offset).limit(limit)).all()

    zones_response = []
    for zone in zones_result:
        record_count = session.exec(
            select(func.count(DNSRecord.id)).where(DNSRecord.zone_id == zone.id)
        ).one()
        zones_response.append(
            HostedZoneResponse(
                id=zone.id,
                name=zone.name,
                type=zone.type,
                comment=zone.comment,
                created_at=zone.created_at,
                updated_at=zone.updated_at,
                record_count=record_count,
            )
        )

    return HostedZoneListResponse(
        zones=zones_response, total=total, page=page, limit=limit
    )


@router.post(
    "/hosted-zones",
    response_model=HostedZoneResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_zone(
    zone_in: HostedZoneCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new hosted zone and auto-seed SOA and NS records for Public zones."""
    # Ensure domain ends with a dot
    if not zone_in.name.endswith("."):
        zone_in.name += "."

    zone = HostedZone(**zone_in.model_dump())
    session.add(zone)
    session.commit()
    session.refresh(zone)

    # Auto-seed standard SOA and NS records matching AWS Route 53 default behavior
    soa_record = DNSRecord(
        zone_id=zone.id,
        name=zone.name,
        type="SOA",
        value="ns-1447.awsdns-52.org. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400",
        ttl=900,
    )
    ns_record = DNSRecord(
        zone_id=zone.id,
        name=zone.name,
        type="NS",
        value="ns-1447.awsdns-52.org.\nns-372.awsdns-46.com.\nns-1957.awsdns-52.co.uk.\nns-691.awsdns-22.net.",
        ttl=172800,
    )
    session.add(soa_record)
    session.add(ns_record)
    session.commit()

    record_count = session.exec(
        select(func.count(DNSRecord.id)).where(DNSRecord.zone_id == zone.id)
    ).one()
    return HostedZoneResponse(**zone.model_dump(), record_count=record_count)


@router.get("/hosted-zones/{zone_id}", response_model=HostedZoneResponse)
async def get_zone(
    zone_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get hosted zone details by ID."""
    zone = session.get(HostedZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")
    record_count = session.exec(
        select(func.count(DNSRecord.id)).where(DNSRecord.zone_id == zone.id)
    ).one()
    return HostedZoneResponse(**zone.model_dump(), record_count=record_count)


@router.put("/hosted-zones/{zone_id}", response_model=HostedZoneResponse)
async def update_zone(
    zone_id: int,
    zone_update: HostedZoneUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update hosted zone type or description."""
    zone = session.get(HostedZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

    update_data = zone_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(zone, key, value)

    zone.updated_at = datetime.utcnow()
    session.add(zone)
    session.commit()
    session.refresh(zone)

    record_count = session.exec(
        select(func.count(DNSRecord.id)).where(DNSRecord.zone_id == zone.id)
    ).one()
    return HostedZoneResponse(**zone.model_dump(), record_count=record_count)


@router.delete("/hosted-zones/{zone_id}")
async def delete_zone(
    zone_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete hosted zone and all associated DNS records."""
    zone = session.get(HostedZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")

    session.delete(zone)
    session.commit()
    return {"message": "Hosted zone deleted successfully"}
