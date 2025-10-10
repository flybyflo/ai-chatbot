#!/usr/bin/env python3
"""Test script for link reader functionality."""

import asyncio
import logging
from web_summarizer import LinkReader, find_url, chunk_text

async def test_link_reader():
    """Test the link reader functionality."""
    print("Testing link reader functionality...")
    
    # Test 1: URL detection
    print("\n1. Testing URL detection:")
    test_texts = [
        "Check out this article: https://example.com/article",
        "Visit https://blog.example.org/post/123 for more info",
        "No URL here, just regular text",
        "Multiple URLs: https://first.com and https://second.org",
    ]
    
    for text in test_texts:
        url = find_url(text)
        print(f"  '{text}' -> {url or 'No URL found'}")
    
    # Test 2: Text chunking
    print("\n2. Testing text chunking:")
    long_text = "This is a test. " * 1000  # Create a long text
    chunks = chunk_text(long_text, max_chars=100)
    print(f"  Long text ({len(long_text)} chars) -> {len(chunks)} chunks")
    print(f"  First chunk: {chunks[0][:50]}...")
    
    # Test 3: Link reader (with a real URL)
    print("\n3. Testing link reader with a real URL:")
    reader = LinkReader()
    
    # Use a simple, reliable URL for testing
    test_url = "https://httpbin.org/html"
    
    try:
        print(f"  Fetching: {test_url}")
        page = await reader.fetch_and_extract(test_url)
        print(f"  Title: {page.title}")
        print(f"  Word count: {page.word_count}")
        print(f"  Text preview: {page.text[:100]}...")
        
        if page.word_count > 0:
            chunks = chunk_text(page.text, max_chars=1000)
            print(f"  Would be chunked into {len(chunks)} pieces for summarization")
        
    except Exception as e:
        print(f"  Error: {e}")
    
    print("\nLink reader test completed!")

if __name__ == "__main__":
    asyncio.run(test_link_reader())
