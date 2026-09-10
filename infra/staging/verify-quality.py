"""Check GitHub's actual Quality job for this repository and exact commit."""
import json
import re
import sys
import urllib.request

revision = sys.argv[1]
if not re.fullmatch(r"[a-f0-9]{40}", revision):
    sys.exit("Invalid revision")
root = "https://api.github.com/repos/MrSantana1990/HelpSystem-Pro-Viagens"


def get(path):
    request = urllib.request.Request(root + path, headers={"Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


runs = get(f"/actions/workflows/ci.yml/runs?head_sha={revision}&per_page=20")
for run in runs["workflow_runs"]:
    if run["event"] != "push" or run["head_branch"] not in ("main", "agent/staging-provisioning-cd"):
        continue
    jobs = get(f'/actions/runs/{run["id"]}/jobs')
    if any(job["name"] == "quality" and job["conclusion"] == "success" for job in jobs["jobs"]):
        artifacts = get(f'/actions/runs/{run["id"]}/artifacts')
        matching = [artifact for artifact in artifacts['artifacts'] if not artifact['expired'] and re.fullmatch(f'staging-images-{revision}-[a-f0-9]{{64}}', artifact['name'])]
        if matching:
            latest = max(matching, key=lambda artifact: artifact['id'])
            print(json.dumps({"qualityRun": run["id"], "revision": revision, "archiveSha256": latest['name'].rsplit('-', 1)[1]}))
            break
else:
    sys.exit("Successful Quality for this revision required")
