import urllib.request
import urllib.parse
import sys

BASE_URL = "http://localhost:3000"

class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def test_middleware():
    opener = urllib.request.build_opener(NoRedirectHandler)

    print("--- 1. Testing Unauthenticated Request to /hosted-zones ---")
    try:
        req = urllib.request.Request(f"{BASE_URL}/hosted-zones")
        resp = opener.open(req)
        status = resp.getcode()
        location = resp.headers.get("Location")
    except urllib.error.HTTPError as e:
        status = e.code
        location = e.headers.get("Location")

    print(f"Status: {status}, Redirect Location: {location}")
    assert status in (307, 308) and "/login" in str(location), f"Expected redirect to /login, got status={status}, loc={location}"
    print("[SUCCESS] Middleware redirected unauthenticated user from /hosted-zones to /login.")

    print("\n--- 2. Testing Access to /login ---")
    req = urllib.request.Request(f"{BASE_URL}/login")
    with urllib.request.urlopen(req) as resp:
        status = resp.getcode()
        body = resp.read().decode("utf-8")
    assert status == 200
    assert "Sign in" in body or "username" in body.lower()
    print("[SUCCESS] /login rendered successfully.")

    print("\n--- 3. Testing Authenticated Request to /login (Should redirect to /hosted-zones) ---")
    try:
        req = urllib.request.Request(f"{BASE_URL}/login", headers={"Cookie": "auth_token=fake-test-jwt-token"})
        resp = opener.open(req)
        status = resp.getcode()
        location = resp.headers.get("Location")
    except urllib.error.HTTPError as e:
        status = e.code
        location = e.headers.get("Location")

    print(f"Status: {status}, Redirect Location: {location}")
    assert status in (307, 308) and "/hosted-zones" in str(location), f"Expected redirect to /hosted-zones, got status={status}, loc={location}"
    print("[SUCCESS] Middleware redirected authenticated user from /login to /hosted-zones.")

    print("\n--- 4. Testing Authenticated Access to /hosted-zones ---")
    req = urllib.request.Request(f"{BASE_URL}/hosted-zones", headers={"Cookie": "auth_token=fake-test-jwt-token"})
    with urllib.request.urlopen(req) as resp:
        status = resp.getcode()
        body = resp.read().decode("utf-8")
    assert status == 200
    assert "Hosted zones" in body
    print("[SUCCESS] /hosted-zones rendered successfully with auth token.")

    print("\n--- 5. Testing Authenticated Access to Placeholder Pages ---")
    for page in ["dashboard", "traffic-policies", "health-checks", "resolver", "profiles"]:
        req = urllib.request.Request(f"{BASE_URL}/{page}", headers={"Cookie": "auth_token=fake-test-jwt-token"})
        with urllib.request.urlopen(req) as resp:
            assert resp.getcode() == 200
        print(f"[SUCCESS] Placeholder page /{page} loaded with 200 OK.")

    print("\n=============================================")
    print("ALL FRONTEND MIDDLEWARE & ROUTE TESTS PASSED!")
    print("=============================================")

if __name__ == "__main__":
    test_middleware()
