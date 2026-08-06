"""SSRF guard on services/web.scrape(). Uses IP-literal URLs throughout so
these tests never touch a real DNS resolver or the network — parsing a
literal IP is instant and offline-safe.
"""
import socket
from unittest.mock import patch

import pytest

from app.services.web import UnsafeURL, _reject_if_unsafe


def test_allows_a_public_ip():
    _reject_if_unsafe("http://8.8.8.8/")   # must not raise


def test_blocks_loopback():
    with pytest.raises(UnsafeURL):
        _reject_if_unsafe("http://127.0.0.1/")


def test_blocks_cloud_metadata_address():
    with pytest.raises(UnsafeURL):
        _reject_if_unsafe("http://169.254.169.254/latest/meta-data/")


@pytest.mark.parametrize("host", ["10.0.0.5", "172.16.0.1", "192.168.1.1"])
def test_blocks_rfc1918_private_ranges(host):
    with pytest.raises(UnsafeURL):
        _reject_if_unsafe(f"http://{host}/")


def test_blocks_non_http_scheme():
    with pytest.raises(UnsafeURL):
        _reject_if_unsafe("file:///etc/passwd")


def test_blocks_ftp_scheme_even_to_a_public_ip():
    with pytest.raises(UnsafeURL):
        _reject_if_unsafe("ftp://8.8.8.8/")


def test_blocks_url_with_no_host():
    with pytest.raises(UnsafeURL):
        _reject_if_unsafe("http:///path-only")


def test_blocks_unresolvable_host():
    with patch("socket.getaddrinfo", side_effect=socket.gaierror("not found")):
        with pytest.raises(UnsafeURL):
            _reject_if_unsafe("http://this-does-not-resolve.invalid/")
