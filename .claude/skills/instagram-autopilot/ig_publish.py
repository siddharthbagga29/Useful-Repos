#!/usr/bin/env python3
"""Publish one approved post through Instagram's official API (Instagram API with Instagram Login).

Dry run unless IG_PUBLISH=1 AND --yes. Standard library only.

  ig_publish.py lint --caption "text"                 check a caption against Instagram's limits
  ig_publish.py limit                                 API publishing quota used in the last 24 h
  ig_publish.py publish --queue queue/<id>.json [--yes]
  ig_publish.py insights --media <media-id>

Environment (his machine, never the repo):
  IG_USER_ID, IG_ACCESS_TOKEN   from a professional account connected to his Meta app
  IG_GRAPH_VERSION              optional, e.g. v23.0; unversioned calls use the app's default
  IG_PUBLISH=1                  required, with --yes, for anything that posts
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HOST = "https://graph.instagram.com"
CAPTION_MAX = 2200  # Instagram's caption limit
HASHTAG_MAX = 30  # Instagram rejects more than 30
MENTION_MAX = 20
CAROUSEL_MAX = 10  # older accounts may be capped lower; the API will say so


def lint(caption: str) -> list[str]:
    problems = []
    if len(caption) > CAPTION_MAX:
        problems.append(f"caption is {len(caption)} characters (max {CAPTION_MAX})")
    tags = re.findall(r"(?<!\w)#\w+", caption)
    if len(tags) > HASHTAG_MAX:
        problems.append(f"{len(tags)} hashtags (max {HASHTAG_MAX})")
    mentions = re.findall(r"(?<!\w)@[\w.]+", caption)
    if len(mentions) > MENTION_MAX:
        problems.append(f"{len(mentions)} @mentions (max {MENTION_MAX})")
    if "{{" in caption:
        problems.append("caption still has a {{placeholder}}")
    if "—" in caption:
        problems.append("em dash left in the caption (run /ig-human)")
    for ch in caption:
        if ch in "​‌‍⁠﻿":
            problems.append("invisible characters in the caption (run /ig-human)")
            break
    return problems


def check_media(urls: list[str]) -> list[str]:
    bad = [u for u in urls if not u.startswith("https://")]
    return [f"media URL must be public HTTPS: {u}" for u in bad]


def build_requests(item: dict, user_id: str) -> list[tuple[str, str, dict]]:
    """The calls a publish makes, in order, as (method, path, params). Tokens are added later."""
    kind = item.get("type")
    media = item.get("media") or []
    caption = item.get("caption", "")
    if kind == "reel":
        if len(media) != 1:
            raise ValueError("a reel needs exactly one video URL in media")
        return [("POST", f"/{user_id}/media", {"media_type": "REELS", "video_url": media[0], "caption": caption}), ("POST", f"/{user_id}/media_publish", {"creation_id": "<container>"})]
    if kind == "carousel":
        if not 2 <= len(media) <= CAROUSEL_MAX:
            raise ValueError(f"a carousel needs 2 to {CAROUSEL_MAX} image URLs in media")
        calls = [("POST", f"/{user_id}/media", {"image_url": u, "is_carousel_item": "true"}) for u in media]
        calls.append(("POST", f"/{user_id}/media", {"media_type": "CAROUSEL", "children": "<children>", "caption": caption}))
        calls.append(("POST", f"/{user_id}/media_publish", {"creation_id": "<container>"}))
        return calls
    if kind in ("image", "post"):
        if len(media) != 1:
            raise ValueError("an image post needs exactly one image URL in media")
        return [("POST", f"/{user_id}/media", {"image_url": media[0], "caption": caption}), ("POST", f"/{user_id}/media_publish", {"creation_id": "<container>"})]
    raise ValueError(f"type {kind!r} can't be published through the API (stories and drafts are posted by hand)")


def api(method: str, path: str, params: dict, token: str) -> dict:
    version = os.environ.get("IG_GRAPH_VERSION", "").strip("/")
    url = f"{HOST}/{version}{path}" if version else f"{HOST}{path}"
    data = urllib.parse.urlencode({**params, "access_token": token}).encode()
    req = urllib.request.Request(url if method == "POST" else f"{url}?{data.decode()}", data=data if method == "POST" else None, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise SystemExit(f"Instagram API {e.code}: {body[:400]}") from None


def wait_ready(container: str, token: str, minutes: int = 10) -> None:
    """Video containers process asynchronously; publishing before FINISHED fails."""
    deadline = time.time() + minutes * 60
    while time.time() < deadline:
        st = api("GET", f"/{container}", {"fields": "status_code"}, token).get("status_code")
        if st == "FINISHED":
            return
        if st in ("ERROR", "EXPIRED"):
            raise SystemExit(f"container {container} is {st}")
        time.sleep(15)
    raise SystemExit(f"container {container} not ready after {minutes} min; nothing was published")


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("lint").add_argument("--caption", required=True)
    sub.add_parser("limit")
    pub = sub.add_parser("publish")
    pub.add_argument("--queue", required=True)
    pub.add_argument("--yes", action="store_true")
    ins = sub.add_parser("insights")
    ins.add_argument("--media", required=True)
    a = p.parse_args(argv)

    if a.cmd == "lint":
        problems = lint(a.caption)
        print("\n".join(problems) if problems else "caption OK")
        return 1 if problems else 0

    user_id, token = os.environ.get("IG_USER_ID", ""), os.environ.get("IG_ACCESS_TOKEN", "")

    if a.cmd == "publish":
        with open(a.queue, encoding="utf-8") as f:
            item = json.load(f)
        if item.get("approved") is not True:
            print(f"refused: {item.get('id', a.queue)} is not approved", file=sys.stderr)
            return 1
        if item.get("status") == "posted":
            print(f"refused: {item.get('id')} is already posted", file=sys.stderr)
            return 1
        problems = lint(item.get("caption", "")) + check_media(item.get("media") or [])
        try:
            calls = build_requests(item, user_id or "<IG_USER_ID>")
        except ValueError as e:
            problems.append(str(e))
        if problems:
            print("refused:\n- " + "\n- ".join(problems), file=sys.stderr)
            return 1
        live = os.environ.get("IG_PUBLISH") == "1" and a.yes
        if not live:
            print(f"DRY RUN for {item.get('id')} (set IG_PUBLISH=1 and pass --yes to post):")
            for m, path, params in calls:
                shown = {k: (v[:60] + "…" if isinstance(v, str) and len(v) > 60 else v) for k, v in params.items()}
                print(f"  {m} {HOST}{path} {json.dumps(shown)} access_token=<redacted>")
            return 0
        if not (user_id and token):
            print("refused: IG_USER_ID and IG_ACCESS_TOKEN must be set", file=sys.stderr)
            return 1
        children = []
        container = ""
        for m, path, params in calls:
            if path.endswith("/media_publish"):
                if item["type"] == "reel":
                    wait_ready(container, token)
                out = api(m, path, {"creation_id": container}, token)
                item.update(status="posted", media_id=out.get("id"), posted_at=time.strftime("%Y-%m-%dT%H:%M:%S%z"))
                with open(a.queue, "w", encoding="utf-8") as f:
                    json.dump(item, f, indent=2)
                print(f"published {item.get('id')} as media {out.get('id')}")
                return 0
            if params.get("children") == "<children>":
                params = {**params, "children": ",".join(children)}
            out = api(m, path, params, token)
            if params.get("is_carousel_item"):
                children.append(out["id"])
            else:
                container = out["id"]
        return 1

    if not (user_id and token):
        print("IG_USER_ID and IG_ACCESS_TOKEN must be set", file=sys.stderr)
        return 1
    if a.cmd == "limit":
        print(json.dumps(api("GET", f"/{user_id}/content_publishing_limit", {"fields": "config,quota_usage"}, token), indent=2))
        return 0
    if a.cmd == "insights":
        fields = "reach,likes,comments,saved,shares,total_interactions"
        print(json.dumps(api("GET", f"/{a.media}/insights", {"metric": fields}, token), indent=2))
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
