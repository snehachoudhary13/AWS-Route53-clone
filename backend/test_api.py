import urllib.request
import urllib.parse
import json
import sys

BASE_URL = "http://127.0.0.1:8000/api"

def make_request(url, method="GET", data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    encoded_data = json.dumps(data).encode("utf-8") if data else None
    
    # Handle form urlencoded for login if needed
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as resp:
            status_code = resp.getcode()
            response_body = resp.read().decode("utf-8")
            return status_code, json.loads(response_body) if response_body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            parsed_body = json.loads(body)
        except Exception:
            parsed_body = body
        return e.code, parsed_body

def login(username, password):
    url = f"{BASE_URL}/auth/login"
    data = urllib.parse.urlencode({"username": username, "password": password}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        return res["access_token"]

def run_tests():
    print("--- 1. Testing Auth Login ---")
    token = login("admin", "password123")
    print(f"[SUCCESS] Obtained access token: {token[:15]}...")

    print("\n--- 2. Testing 401 Unauthorized ---")
    status, res = make_request(f"{BASE_URL}/hosted-zones")
    assert status == 401, f"Expected 401, got {status}"
    print("[SUCCESS] Protected endpoint returned 401 without token.")

    print("\n--- 3. Testing GET /api/hosted-zones (List & Search & Pagination) ---")
    status, res = make_request(f"{BASE_URL}/hosted-zones", token=token)
    assert status == 200, f"Expected 200, got {status}"
    assert "zones" in res and "total" in res
    initial_total = res["total"]
    print(f"[SUCCESS] GET /hosted-zones returned total {initial_total} zones.")

    status, res = make_request(f"{BASE_URL}/hosted-zones?search=example", token=token)
    assert status == 200
    print(f"[SUCCESS] GET /hosted-zones with search returned {len(res['zones'])} matching zones.")

    print("\n--- 4. Testing POST /api/hosted-zones (Create Public Zone) ---")
    new_zone_payload = {"name": "testzone.org", "type": "Public", "comment": "Automated test zone"}
    status, created_zone = make_request(f"{BASE_URL}/hosted-zones", method="POST", data=new_zone_payload, token=token)
    assert status == 201, f"Expected 201, got {status}"
    zone_id = created_zone["id"]
    assert created_zone["name"] == "testzone.org."
    assert created_zone["record_count"] == 2  # Auto-seeded SOA and NS records
    print(f"[SUCCESS] Created hosted zone ID {zone_id} with status 201 and 2 auto-seeded records.")

    print("\n--- 5. Testing GET /api/hosted-zones/{id} ---")
    status, zone_detail = make_request(f"{BASE_URL}/hosted-zones/{zone_id}", token=token)
    assert status == 200
    assert zone_detail["id"] == zone_id
    print(f"[SUCCESS] GET /hosted-zones/{zone_id} retrieved zone successfully.")

    print("\n--- 6. Testing PUT /api/hosted-zones/{id} ---")
    update_payload = {"comment": "Updated comment by test script"}
    status, updated_zone = make_request(f"{BASE_URL}/hosted-zones/{zone_id}", method="PUT", data=update_payload, token=token)
    assert status == 200
    assert updated_zone["comment"] == "Updated comment by test script"
    print(f"[SUCCESS] PUT /hosted-zones/{zone_id} updated comment.")

    print("\n--- 7. Testing GET /api/hosted-zones/{id}/records ---")
    status, record_list = make_request(f"{BASE_URL}/hosted-zones/{zone_id}/records", token=token)
    assert status == 200, f"Expected 200, got status={status}, body={record_list}"
    assert len(record_list["records"]) == 2, f"Expected 2 records, got {len(record_list['records'])}: {record_list}"
    print(f"[SUCCESS] GET records returned {record_list['total']} records.")

    status, filtered_records = make_request(f"{BASE_URL}/hosted-zones/{zone_id}/records?type=SOA", token=token)
    assert status == 200, f"Expected 200, got status={status}, body={filtered_records}"
    assert len(filtered_records["records"]) == 1, f"Expected 1 record, got {filtered_records}"
    assert filtered_records["records"][0]["type"] == "SOA"
    print(f"[SUCCESS] GET records with type filter returned matching record.")

    print("\n--- 8. Testing POST /api/hosted-zones/{id}/records (Create Record) ---")
    new_record_payload = {
        "name": "api",
        "type": "A",
        "value": "192.168.1.100",
        "ttl": 600
    }
    status, created_record = make_request(f"{BASE_URL}/hosted-zones/{zone_id}/records", method="POST", data=new_record_payload, token=token)
    assert status == 201, f"Expected 201, got {status}, body={created_record}"
    record_id = created_record["id"]
    assert created_record["name"] == "api.testzone.org."
    print(f"[SUCCESS] Created record ID {record_id} with status 201: {created_record['name']} -> {created_record['value']}.")

    print("\n--- 9. Testing PUT /api/hosted-zones/{id}/records/{record_id} ---")
    record_update_payload = {"value": "192.168.1.200", "ttl": 1200}
    status, updated_record = make_request(f"{BASE_URL}/hosted-zones/{zone_id}/records/{record_id}", method="PUT", data=record_update_payload, token=token)
    assert status == 200, f"Expected 200, got {status}, body={updated_record}"
    assert updated_record["value"] == "192.168.1.200"
    assert updated_record["ttl"] == 1200
    print(f"[SUCCESS] Updated record ID {record_id} successfully.")

    print("\n--- 10. Testing DELETE /api/hosted-zones/{id}/records/{record_id} ---")
    status, del_rec_res = make_request(f"{BASE_URL}/hosted-zones/{zone_id}/records/{record_id}", method="DELETE", token=token)
    assert status == 200, f"Expected 200, got {status}, body={del_rec_res}"
    print(f"[SUCCESS] Deleted record ID {record_id}.")

    # Verify record was deleted
    status, rec_check = make_request(f"{BASE_URL}/hosted-zones/{zone_id}/records/{record_id}", method="PUT", data={"ttl": 300}, token=token)
    assert status == 404, f"Expected 404, got {status}"
    print("[SUCCESS] 404 returned on deleted record access.")

    print("\n--- 11. Testing DELETE /api/hosted-zones/{id} ---")
    status, del_zone_res = make_request(f"{BASE_URL}/hosted-zones/{zone_id}", method="DELETE", token=token)
    assert status == 200, f"Expected 200, got {status}, body={del_zone_res}"
    print(f"[SUCCESS] Deleted hosted zone ID {zone_id}.")

    # Verify zone was deleted
    status, zone_check = make_request(f"{BASE_URL}/hosted-zones/{zone_id}", token=token)
    assert status == 404, f"Expected 404, got {status}"
    print("[SUCCESS] 404 returned on deleted zone access.")

    # Verify records endpoint returns 404 for deleted zone
    status, rec_zone_check = make_request(f"{BASE_URL}/hosted-zones/{zone_id}/records", token=token)
    assert status == 404, f"Expected 404, got {status}"
    print("[SUCCESS] 404 returned for records of non-existent zone.")

    print("\n=============================================")
    print("ALL API ENDPOINTS TESTED AND PASSED VERIFICATION!")
    print("=============================================")

if __name__ == "__main__":
    run_tests()
