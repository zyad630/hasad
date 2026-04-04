import urllib.request
import json

data = json.dumps({"username": "admin", "password": "123"}).encode()
req = urllib.request.Request(
    "http://127.0.0.1:8000/api/auth/login/",
    data=data,
    headers={"Content-Type": "application/json"}
)
try:
    resp = urllib.request.urlopen(req)
    body = json.loads(resp.read().decode())
    print("STATUS: 200 OK")
    print("access token:", body.get("access", "")[:60] + "...")
    print("user:", body.get("user", {}))
except urllib.error.HTTPError as e:
    print("STATUS:", e.code)
    print("BODY:", e.read().decode())
except Exception as e:
    print("ERROR:", e)
