import io

import pytest
from docx import Document
from pypdf import PdfWriter

from app.services.documents import UnsupportedDocumentType, extract_text


def _docx_bytes(paragraphs: list[str]) -> bytes:
    doc = Document()
    for p in paragraphs:
        doc.add_paragraph(p)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _blank_pdf_bytes() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def test_extracts_plain_txt():
    result = extract_text("notes.txt", b"Minimum down payment is 15 percent.")
    assert result.file_type == "txt"
    assert "15 percent" in result.text
    assert result.warnings == []


def test_extracts_markdown_as_plain_text():
    result = extract_text("readme.md", b"# Title\n\nSome **bold** content.")
    assert result.file_type == "md"
    assert "bold" in result.text


def test_extracts_docx_paragraphs():
    content = _docx_bytes(["First paragraph.", "Second paragraph with a number: 42."])
    result = extract_text("statement.docx", content)
    assert result.file_type == "docx"
    assert "First paragraph." in result.text
    assert "Second paragraph with a number: 42." in result.text


def test_blank_pdf_warns_about_missing_text():
    result = extract_text("scan.pdf", _blank_pdf_bytes())
    assert result.file_type == "pdf"
    assert result.text == ""
    assert any("scanned" in w.lower() or "image-only" in w.lower() for w in result.warnings)


def test_unsupported_extension_is_rejected():
    with pytest.raises(UnsupportedDocumentType):
        extract_text("archive.zip", b"PK\x03\x04")


def test_no_extension_is_rejected():
    with pytest.raises(UnsupportedDocumentType):
        extract_text("noextension", b"whatever")


def test_truncates_to_max_chars_and_warns():
    long_text = ("word " * 10000).encode()
    result = extract_text("big.txt", long_text, max_chars=50)
    assert result.chars == 50
    assert any("truncated" in w.lower() for w in result.warnings)


def test_collapses_excess_blank_lines():
    result = extract_text("spaced.txt", b"line one\n\n\n\n\nline two")
    assert "\n\n\n" not in result.text
