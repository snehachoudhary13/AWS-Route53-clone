from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

# --- User & Auth Schemas ---
class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

# --- Hosted Zone Schemas ---
class HostedZoneBase(BaseModel):
    name: str
    type: str
    comment: Optional[str] = None

class HostedZoneCreate(HostedZoneBase):
    pass

class HostedZoneUpdate(BaseModel):
    comment: Optional[str] = None
    type: Optional[str] = None

class HostedZoneResponse(HostedZoneBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
    record_count: int = 0

class HostedZoneListResponse(BaseModel):
    zones: List[HostedZoneResponse]
    total: int
    page: int
    limit: int

# --- DNS Record Schemas ---
class DNSRecordBase(BaseModel):
    name: str
    type: str
    value: str
    ttl: int = 300
    priority: Optional[int] = None
    weight: Optional[int] = None
    port: Optional[int] = None

class DNSRecordCreate(DNSRecordBase):
    pass

class DNSRecordUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    value: Optional[str] = None
    ttl: Optional[int] = None
    priority: Optional[int] = None
    weight: Optional[int] = None
    port: Optional[int] = None

class DNSRecordResponse(DNSRecordBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    zone_id: int
    created_at: datetime
    updated_at: datetime

class DNSRecordListResponse(BaseModel):
    records: List[DNSRecordResponse]
    total: int
    page: int
    limit: int
