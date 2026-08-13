from datetime import datetime
from typing import List, Optional

from sqlmodel import Field, Relationship, SQLModel


class User(SQLModel, table=True):
    """User entity for authentication."""

    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class HostedZone(SQLModel, table=True):
    """A DNS hosted zone (e.g. example.com)."""

    __tablename__ = "hosted_zones"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    type: str  # "Public" | "Private"
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship — cascade delete handled at the SA level
    records: List["DNSRecord"] = Relationship(
        back_populates="zone",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class DNSRecord(SQLModel, table=True):
    """A single DNS record within a hosted zone."""

    __tablename__ = "dns_records"

    id: Optional[int] = Field(default=None, primary_key=True)
    zone_id: int = Field(foreign_key="hosted_zones.id", index=True)
    name: str
    type: str  # A | AAAA | CNAME | TXT | MX | NS | PTR | SRV | CAA
    value: str
    ttl: int = 300
    priority: Optional[int] = None  # MX, SRV
    weight: Optional[int] = None    # SRV
    port: Optional[int] = None      # SRV
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    zone: Optional[HostedZone] = Relationship(back_populates="records")
