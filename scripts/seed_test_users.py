#!/usr/bin/env python3
"""Seed a lively cast of test users for Collide scale-testing.

Creates ~10 named users (password/PIN: 424242), joins them to communities,
connects their circles (including to the owner + Maya Flows), RSVPs them to
events, posts community + event chat, votes polls, drops yaps, and taps otw.
Safe to re-run: existing users are looked up, duplicate-key inserts skipped.

Env: COLLIDE_URL, COLLIDE_SERVICE (service-role key).
"""
import json, os, random, urllib.request, urllib.error, datetime

URL = os.environ["COLLIDE_URL"].rstrip("/")
SVC = os.environ["COLLIDE_SERVICE"]
H = {"apikey": SVC, "Authorization": f"Bearer {SVC}", "Content-Type": "application/json",
     "Prefer": "return=representation,resolution=merge-duplicates"}

def svc(method, path, body=None, ok_dup=True):
    r = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body is not None else None,
                               method=method, headers=H)
    try:
        resp = urllib.request.urlopen(r, timeout=30)
        return json.loads(resp.read() or "null")
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:120]
        if ok_dup and ("23505" in msg or e.code == 409):
            return None
        raise RuntimeError(f"{path} -> {e.code} {msg}")

CAST = [
    ("jules.rivera@example.com",  "Jules Rivera",  ["Rose Sounds", "Hot Spots"]),
    ("andre.okafor@example.com",  "Andre Okafor",  ["Sweat Now", "Rose Sounds"]),
    ("priya.patel@example.com",   "Priya Patel",   ["Hot Spots", "CircleBlk"]),
    ("tommy.nguyen@example.com",  "Tommy Nguyen",  ["Sweat Now"]),
    ("zoe.kim@example.com",       "Zoe Kim",       ["Rose Sounds", "CircleBlk"]),
    ("marcus.bell@example.com",   "Marcus Bell",   ["Hot Spots", "Sweat Now"]),
    ("sofia.reyes@example.com",   "Sofia Reyes",   ["Rose Sounds"]),
    ("dev.sharma@example.com",    "Dev Sharma",    ["CircleBlk", "Hot Spots"]),
    ("lena.brooks@example.com",   "Lena Brooks",   ["Sweat Now", "Rose Sounds"]),
    ("kofi.mensah@example.com",   "Kofi Mensah",   ["Hot Spots", "Rose Sounds"]),
]

def get_or_create_user(email, name):
    d = svc("GET", "/auth/v1/admin/users?page=1&per_page=200")
    for u in d.get("users", []):
        if u["email"] == email:
            return u["id"]
    d = svc("POST", "/auth/v1/admin/users", {"email": email, "password": "424242", "email_confirm": True}, ok_dup=False)
    uid = d["id"]
    svc("PATCH", f"/rest/v1/profiles?id=eq.{uid}",
        {"display_name": name, "socials": {"instagram": "@" + name.lower().replace(" ", ".")}})
    return uid

def connect(a, b):
    lo, hi = (a, b) if a < b else (b, a)
    svc("POST", "/rest/v1/connections", {"a": lo, "b": hi})

def main():
    random.seed(42)  # deterministic runs
    comms = {c["name"]: c for c in svc("GET", "/rest/v1/communities?select=id,name,x,y")}
    events = svc("GET", "/rest/v1/activities?community_id=not.is.null&select=id,title,community_id") or []
    all_events = svc("GET", "/rest/v1/activities?select=id,title,community_id") or []
    owner = (svc("GET", "/rest/v1/staff?role=eq.owner&select=profile_id") or [{}])[0].get("profile_id")
    maya = (svc("GET", "/rest/v1/profiles?display_name=eq.Maya%20Flows&select=id") or [{}])[0].get("id")

    ids = {}
    for email, name, memberships in CAST:
        uid = get_or_create_user(email, name)
        ids[name] = uid
        for cname in memberships:
            if cname in comms:
                svc("POST", "/rest/v1/community_members",
                    {"community_id": comms[cname]["id"], "profile_id": uid, "status": "member"})
        print(f"  ✓ {name} ({uid[:8]}) → {', '.join(memberships)}")

    names = list(ids)
    # circles: each connects to 3-4 castmates + sprinkle owner/Maya connections
    for i, n in enumerate(names):
        for j in range(1, 4):
            connect(ids[n], ids[names[(i + j) % len(names)]])
    if owner:
        for n in names[:5]: connect(ids[n], owner)
    if maya:
        for n in ("Andre Okafor", "Tommy Nguyen", "Lena Brooks", "Marcus Bell"):
            connect(ids[n], maya)
    print("  ✓ circles connected (mesh + owner + Maya)")

    # RSVPs: 3-5 per event, community members first
    member_of = {n: set(m) for (_, n, m) in [(e, n, m) for e, n, m in CAST]}
    for ev in all_events:
        cname = next((k for k, v in comms.items() if v["id"] == ev.get("community_id")), None)
        pool = [n for n in names if (cname is None or cname in member_of[n])] or names
        for n in random.sample(pool, min(len(pool), random.randint(3, 5))):
            svc("POST", "/rest/v1/rsvps", {"activity_id": ev["id"], "profile_id": ids[n], "status": "going"})
    print(f"  ✓ RSVPs spread across {len(all_events)} events")

    # community chat
    CHAT = {
        "Rose Sounds": [("Jules Rivera", "who's opening for the kickoff set?? the anticipation 🎧"),
                        ("Sofia Reyes", "bringing two friends saturday, they don't know what's coming"),
                        ("Zoe Kim", "someone request more disco this time 🪩")],
        "Hot Spots":  [("Priya Patel", "found a dumpling spot that changed my life. dropping a dot later 🥟"),
                       ("Kofi Mensah", "rating every taco within 3 blocks of the bridge. thread soon"),
                       ("Marcus Bell", "brunch crawl this weekend? say less")],
        "Sweat Now":  [("Tommy Nguyen", "hill repeats destroyed me and I'll be back for more"),
                       ("Lena Brooks", "who's doing maya's sunrise run?? need accountability"),
                       ("Andre Okafor", "5am club is real. join us or sleep, your call 😤")],
        "CircleBlk":  [("Dev Sharma", "first dinner party menu ideas — drop your cravings"),
                       ("Zoe Kim", "candles + a long table + strangers becoming family. ready")],
    }
    for cname, msgs in CHAT.items():
        if cname not in comms: continue
        for who, body in msgs:
            svc("POST", "/rest/v1/community_messages",
                {"community_id": comms[cname]["id"], "author_id": ids[who], "kind": "text", "body": body})
    print("  ✓ community chats posted")

    # a poll + votes in Hot Spots; votes on Maya's Sweat Now poll
    hp = svc("POST", "/rest/v1/community_messages",
             {"community_id": comms["Hot Spots"]["id"], "author_id": ids["Kofi Mensah"], "kind": "poll",
              "body": "settle it forever:", "poll_options": ["Tacos 🌮", "Dumplings 🥟", "Why not both"]})
    if hp:
        for n, opt in [("Priya Patel", 1), ("Marcus Bell", 2), ("Dev Sharma", 2), ("Jules Rivera", 0)]:
            svc("POST", "/rest/v1/community_poll_votes",
                {"message_id": hp[0]["id"], "profile_id": ids[n], "option_index": opt})
    mp = svc("GET", "/rest/v1/community_messages?kind=eq.poll&select=id,community_id&order=created_at&limit=5")
    for poll in (mp or []):
        if poll["community_id"] == comms.get("Sweat Now", {}).get("id"):
            for n, opt in [("Tommy Nguyen", 0), ("Lena Brooks", 2), ("Andre Okafor", 2)]:
                svc("POST", "/rest/v1/community_poll_votes",
                    {"message_id": poll["id"], "profile_id": ids[n], "option_index": opt})
    print("  ✓ polls + votes")

    # event chat on the two headline events
    for title, msgs in {
        "Rose Sounds Kickoff Set": [("Jules Rivera", "pulling up early for soundcheck vibes"),
                                    ("Zoe Kim", "what's the dress code — sparkle? sparkle.")],
        "DJ Leah Rose's Pool Party": [("Kofi Mensah", "floaties: yes or yes"),
                                      ("Sofia Reyes", "bringing the waterproof speaker as backup 😌")],
    }.items():
        ev = next((e for e in all_events if e["title"] == title), None)
        if ev:
            for who, body in msgs:
                svc("POST", "/rest/v1/event_messages",
                    {"activity_id": ev["id"], "author_id": ids[who], "kind": "text", "body": body})
    print("  ✓ event chats posted")

    # yaps (one per user per day) + otw
    now = datetime.datetime.utcnow()
    YAPS = [
        ("Jules Rivera", "record digging at the flea — come thumb through crates with me 🎶", 0.36, 0.42, 8),
        ("Priya Patel",  "dumpling run happening NOW. you know where to find me 🥟", 0.58, 0.63, 4),
        ("Tommy Nguyen", "track workout 6pm — bring legs, leave ego 🏃", 0.42, 0.50, 8),
        ("Zoe Kim",      "sketching by the water till sunset, come sit 🎨", 0.52, 0.74, 24),
        ("Marcus Bell",  "pickup runs at the courts, next 5 win 🏀", 0.66, 0.58, 4),
        ("Dev Sharma",   "chai + chess in the park. winners stay ♟️", 0.47, 0.36, 24),
    ]
    yap_ids = {}
    for who, body, x, y, hrs in YAPS:
        d = svc("POST", "/rest/v1/yaps", {"author_id": ids[who], "body": body, "x": x, "y": y,
                "expires_at": (now + datetime.timedelta(hours=hrs)).isoformat() + "Z"})
        if d: yap_ids[who] = d[0]["id"]
    print(f"  ✓ {len(yap_ids)} yaps dropped")

    all_yaps = svc("GET", "/rest/v1/yaps?select=id,author_id") or []
    for yp in all_yaps:
        takers = random.sample(names, random.randint(1, 3))
        for n in takers:
            if ids[n] != yp["author_id"]:
                svc("POST", "/rest/v1/yap_otw", {"yap_id": yp["id"], "profile_id": ids[n]})
    print("  ✓ otw taps sprinkled on every live yap")
    print("\nDone — the town is alive. Password/PIN for every test user: 424242")

if __name__ == "__main__":
    main()
