"""One-shot provider acceptance probe. Removed after live diagnosis."""

import json
import os
import urllib.error
import urllib.parse
import urllib.request

QUERY = "Deon Trevor Mpofu"


def request_json(request: urllib.request.Request) -> tuple[int, dict]:
    with urllib.request.urlopen(
        request, timeout=8
    ) as response:  # nosec B310 - fixed HTTPS endpoints
        return response.status, json.load(response)


def serper() -> dict[str, int | str]:
    request = urllib.request.Request(
        "https://google.serper.dev/search",
        data=json.dumps({"q": QUERY, "num": 10}).encode(),
        headers={
            "Content-Type": "application/json",
            "X-API-KEY": os.environ.get("SERPER_API_KEY", ""),
        },
        method="POST",
    )
    status, data = request_json(request)
    return {"status": status, "results": len(data.get("organic") or [])}


def brave() -> dict[str, int | str]:
    query = urllib.parse.urlencode(
        {"q": QUERY, "count": 10, "text_decorations": "false"}
    )
    request = urllib.request.Request(
        f"https://api.search.brave.com/res/v1/web/search?{query}",
        headers={
            "Accept": "application/json",
            "X-Subscription-Token": os.environ.get("BRAVE_API_KEY", ""),
        },
    )
    status, data = request_json(request)
    return {
        "status": status,
        "results": len((data.get("web") or {}).get("results") or []),
    }


def probe(callable_, configured: bool) -> dict[str, int | str | bool]:
    try:
        return {"configured": configured, **callable_()}
    except urllib.error.HTTPError as error:
        return {"configured": configured, "status": error.code, "results": 0}
    except Exception as error:  # pylint: disable=broad-exception-caught
        return {
            "configured": configured,
            "status": type(error).__name__,
            "results": 0,
        }


print(
    json.dumps(
        {
            "serper": probe(serper, bool(os.environ.get("SERPER_API_KEY"))),
            "brave": probe(brave, bool(os.environ.get("BRAVE_API_KEY"))),
        }
    )
)
