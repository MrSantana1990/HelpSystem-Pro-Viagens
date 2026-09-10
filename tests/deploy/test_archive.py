import importlib.util
import io
import json
import pathlib
import tarfile
import tempfile
import unittest

root = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('archive_guard', root/'infra/staging/validate-archive.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)
sha = 'a'*40


class ArchiveBoundary(unittest.TestCase):
    def archive(self, directory, foreign=False, revision=sha, unsafe=False):
        path = pathlib.Path(directory)/'images.tar'
        with tarfile.open(path, 'w') as tar:
            def add(name, value):
                data = json.dumps(value).encode()
                member = tarfile.TarInfo(name)
                member.size = len(data)
                tar.addfile(member, io.BytesIO(data))
            manifest = []
            for service in ('api', 'web'):
                tag = f'viagens-staging-{service}:{sha}'
                if foreign and service == 'api':
                    tag = 'other-product:latest'
                manifest.append({'RepoTags':[tag], 'Config':service+'.json', 'Layers':[]})
                add(service+'.json', {'os':'linux', 'architecture':'amd64', 'config':{'Labels':{'org.opencontainers.image.revision':revision}}})
            add('manifest.json', manifest)
            if unsafe:
                add('../escape', {})
        return path

    def test_only_expected_product_and_sha(self):
        with tempfile.TemporaryDirectory() as directory:
            guard.validate(self.archive(directory), sha)

    def test_foreign_product_image_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                guard.validate(self.archive(directory, foreign=True), sha)

    def test_revision_mismatch_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                guard.validate(self.archive(directory, revision='b'*40), sha)

    def test_host_path_escape_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                guard.validate(self.archive(directory, unsafe=True), sha)

    def test_invalid_revision_rejected(self):
        with self.assertRaises(ValueError):
            guard.validate('unused', '../../other-product')
