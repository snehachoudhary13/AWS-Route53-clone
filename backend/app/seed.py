import os
from sqlmodel import Session, select
from dotenv import load_dotenv

from app.models import User, HostedZone, DNSRecord
from app.auth import get_password_hash

load_dotenv()

def seed_database(session: Session):
    # ── 1. Seed Demo User ───────────────────────────────────────────────────
    existing_user = session.exec(select(User)).first()
    if not existing_user:
        demo_username = os.environ.get("DEMO_USERNAME", "admin")
        demo_password = os.environ.get("DEMO_PASSWORD", "password123")
        
        hashed = get_password_hash(demo_password)
        demo_user = User(username=demo_username, password_hash=hashed)
        session.add(demo_user)
        session.commit()
        session.refresh(demo_user)

        print("\n" + "=" * 56)
        print("  [AUTH SEED] Demo user initialized in SQLite:")
        print(f"  Username: {demo_username}")
        print(f"  Password: {demo_password}")
        print(f"  Hash:     {hashed[:28]}...")
        print("=" * 56 + "\n")

    # ── 2. Seed Example Hosted Zones & DNS Records ───────────────────────────
    if session.exec(select(HostedZone)).first():
        return

    # Zone 1: example.com.
    zone1 = HostedZone(name="example.com.", type="Public", comment="Main corporate website and public services.")
    session.add(zone1)
    session.commit()
    session.refresh(zone1)

    record1_1 = DNSRecord(zone_id=zone1.id, name="example.com.", type="A", value="93.184.216.34", ttl=300)
    record1_2 = DNSRecord(zone_id=zone1.id, name="mail.example.com.", type="MX", value="mail.example.com.", ttl=3600, priority=10)
    record1_3 = DNSRecord(zone_id=zone1.id, name="www.example.com.", type="CNAME", value="example.com.", ttl=300)
    session.add_all([record1_1, record1_2, record1_3])

    # Zone 2: internal.corp.
    zone2 = HostedZone(name="internal.corp.", type="Private", comment="Private internal infrastructure and services.")
    session.add(zone2)
    session.commit()
    session.refresh(zone2)

    record2_1 = DNSRecord(zone_id=zone2.id, name="app.internal.corp.", type="A", value="10.0.1.50", ttl=300)
    record2_2 = DNSRecord(zone_id=zone2.id, name="db.internal.corp.", type="A", value="10.0.2.100", ttl=300)
    record2_3 = DNSRecord(zone_id=zone2.id, name="api.internal.corp.", type="CNAME", value="app.internal.corp.", ttl=300)
    session.add_all([record2_1, record2_2, record2_3])

    # Zone 3: myshop.io.
    zone3 = HostedZone(name="myshop.io.", type="Public", comment="E-commerce production domain.")
    session.add(zone3)
    session.commit()
    session.refresh(zone3)

    record3_1 = DNSRecord(zone_id=zone3.id, name="myshop.io.", type="A", value="52.20.30.40", ttl=300)
    record3_2 = DNSRecord(zone_id=zone3.id, name="myshop.io.", type="TXT", value='"v=spf1 include:sendgrid.net ~all"', ttl=3600)
    record3_3 = DNSRecord(zone_id=zone3.id, name="store.myshop.io.", type="CNAME", value="myshop.io.", ttl=300)
    session.add_all([record3_1, record3_2, record3_3])

    session.commit()
