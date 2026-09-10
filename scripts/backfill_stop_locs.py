#!/usr/bin/env python3
"""Backfill real locations onto hunt/adventure stops (activities.itinerary jsonb).

Runs AS the cast host of each activity (never a human account): searches Google
through the nav edge function (placesearch -> placepull nophotos), sets
lat/lng/address/place/area/radius on stops that have none, keeps x/y and stop
order untouched (check-ins key on array position). Riddle-titled stops get
explicit query overrides. --dry-run prints the table without writing.

  python3 scripts/backfill_stop_locs.py --anon <anon key> [--dry-run]
"""
import argparse, json, math, sys, urllib.request

URL = "https://pjxvvwcnjjizdtiutpxd.supabase.co"
PW = "424242"
CENTER = {"nyc": (40.7306, -73.9866), "atl": (33.7573, -84.3856)}

HUNTS = [
    {"aid": "11111111-0829-4a01-9001-000000000001", "host": "jules.rivera@example.com", "city": "nyc",
     "overrides": {  # riddle titles -> the real spot
         "chess": "Caffe Reggio MacDougal St",
         "record": "Generation Records Thompson St",
         "fountain": "Washington Square Park fountain",
         "10th": "High Line 10th Avenue Square",
         "dumpling": "Nom Wah Tea Parlor Doyers St"}},
    {"aid": "bbbb1111-0830-4a01-b001-000000000005", "host": "dre.holloway.atl@example.com", "city": "atl", "overrides": {}},
]


def post(path, body, anon, tok=None, method="POST"):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode(), method=method,
                                 headers={"apikey": anon, "content-type": "application/json",
                                          "authorization": "Bearer " + (tok or anon), "prefer": "return=minimal"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read() or b"null")


def get(path, anon, tok):
    req = urllib.request.Request(URL + path, headers={"apikey": anon, "authorization": "Bearer " + tok})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--anon", required=True); ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    for h in HUNTS:
        tok = post("/auth/v1/token?grant_type=password", {"email": h["host"], "password": PW}, a.anon)["access_token"]
        rows = get(f"/rest/v1/activities?id=eq.{h['aid']}&select=id,title,itin_kind,itinerary", a.anon, tok)
        if not rows: print("!! not visible as host:", h["aid"]); continue
        act = rows[0]; stops = act["itinerary"] or []
        print(f"\n== {act['title']} ({act['itin_kind']}, {len(stops)} stops) as {h['host']}")
        changed = False
        for i, s in enumerate(stops):
            if isinstance(s.get("lat"), (int, float)) and isinstance(s.get("lng"), (int, float)):
                print(f"  {i+1}. {s['title'][:40]:40} keep  {s.get('place') or s.get('address')}"); continue
            title = s.get("title") or ""
            q = next((v for k, v in h["overrides"].items() if k in title.lower()), title)
            try:
                hits = post("/functions/v1/nav", {"mode": "placesearch", "q": q, "city": h["city"]}, a.anon, tok).get("results") or []
            except Exception as e:
                hits = []; print("   search error", e)
            if not hits:
                print(f"  {i+1}. {title[:40]:40} MISS  ({q})"); continue
            t = hits[0]
            d = post("/functions/v1/nav", {"mode": "placepull", "place_id": t["pid"], "city": h["city"], "nophotos": True}, a.anon, tok)
            if not isinstance(d.get("lat"), (int, float)):
                print(f"  {i+1}. {title[:40]:40} MISS  (no coords for {t['name']})"); continue
            dist = km((d["lat"], d["lng"]), CENTER[h["city"]])
            tok_ok = any(w.lower() in (d.get("name", "") + t.get("name", "")).lower() for w in q.split() if len(w) > 3)
            flag = "" if (dist < 25 and tok_ok) else "  LOW-CONFIDENCE"
            print(f"  {i+1}. {title[:40]:40} ->  {d.get('name')} | {d.get('addr')} | around {d.get('area')} | {dist:.1f} km{flag}")
            s.update({"lat": d["lat"], "lng": d["lng"], "address": (d.get("addr") or t.get("addr") or "")[:160],
                      "place": (d.get("name") or t.get("name") or "")[:80], "area": d.get("area") or "", "radius": s.get("radius") or "md"})
            changed = True
        if changed and not a.dry_run:
            post(f"/rest/v1/activities?id=eq.{h['aid']}", {"itinerary": stops}, a.anon, tok, method="PATCH")
            print("  written.")
        elif changed:
            print("  (dry run — nothing written)")


if __name__ == "__main__":
    main()
