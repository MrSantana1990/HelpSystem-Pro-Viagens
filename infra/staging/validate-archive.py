"""Validate Docker save archives without extracting to the host filesystem."""
import json
import hashlib
import re
import sys
import tarfile
from pathlib import PurePosixPath


def validate(path, revision, expected_digest=None):
    if not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ValueError("Invalid revision")
    expected = {f"viagens-staging-{service}:{revision}" for service in ("api", "web")}
    if expected_digest is not None:
        with open(path, 'rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        if not re.fullmatch('[a-f0-9]{64}', expected_digest) or digest != expected_digest:
            raise ValueError('Artifact digest mismatch')
    with tarfile.open(path, "r:") as archive:
        if len(archive.getnames()) != len(set(archive.getnames())):
            raise ValueError("Duplicate archive names forbidden")
        for member in archive.getmembers():
            name = PurePosixPath(member.name)
            if name.is_absolute() or ".." in name.parts or not (member.isfile() or member.isdir()):
                raise ValueError("Unsafe archive member")
        if 'index.json' in archive.getnames():
            index = json.load(archive.extractfile('index.json'))
            names = {item.get('annotations', {}).get('io.containerd.image.name', '') for item in index['manifests']}
            if names != {'docker.io/library/'+tag for tag in expected} or len(index['manifests']) != 2:
                raise ValueError("Foreign OCI image names forbidden")
        manifest = json.load(archive.extractfile("manifest.json"))
        if len(manifest) != 2:
            raise ValueError("Exactly two images required")
        tags = set()
        for item in manifest:
            if len(item.get("RepoTags", [])) != 1:
                raise ValueError("Exactly one tag per image required")
            tags.update(item["RepoTags"])
            config = json.load(archive.extractfile(item["Config"]))
            labels = config.get("config", {}).get("Labels", {})
            if labels.get("org.opencontainers.image.revision") != revision:
                raise ValueError("Revision label mismatch")
            if config.get("os") != "linux" or config.get("architecture") != "amd64":
                raise ValueError("Unexpected platform")
        if tags != expected:
            raise ValueError("Foreign image tags forbidden")


if __name__ == "__main__":
    try:
        validate(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    except Exception:
        sys.exit("Image archive rejected")
