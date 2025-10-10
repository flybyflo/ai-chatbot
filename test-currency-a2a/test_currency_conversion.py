#!/usr/bin/env python3
"""Test script for currency conversion functionality."""

import asyncio
import httpx
from currency_converter import CurrencyConverter, parse_conversion_query

async def test_currency_conversion():
    """Test the currency conversion functionality."""
    print("Testing currency conversion functionality...")
    
    # Test 1: Parse conversion queries
    print("\n1. Testing query parsing:")
    test_queries = [
        "convert 100 USD to EUR",
        "100 gbp to usd on 2024-12-31",
        "usd 250 in jpy",
        "convert 1,234.56 EUR to USD",
        "What is the weather like today?",  # Should not match
    ]
    
    for query in test_queries:
        parsed = parse_conversion_query(query)
        if parsed:
            amount, from_ccy, to_ccy, date = parsed
            print(f"  '{query}' -> {amount} {from_ccy} to {to_ccy} on {date or 'latest'}")
        else:
            print(f"  '{query}' -> No match (will use LLM)")
    
    # Test 2: Test currency converter
    print("\n2. Testing currency converter:")
    converter = CurrencyConverter()
    
    try:
        # Test supported currencies
        print("  Fetching supported currencies...")
        supported = await converter.supported()
        print(f"  Found {len(supported)} supported currencies")
        print(f"  Sample currencies: {', '.join(sorted(list(supported))[:10])}")
        
        # Test conversion
        print("\n  Testing conversion: 100 USD to EUR")
        result = await converter.convert(100, "USD", "EUR")
        print(f"  Result: {result.amount} {result.to_ccy} (rate: {result.rate} on {result.date})")
        
        # Test historical conversion
        print("\n  Testing historical conversion: 100 USD to EUR on 2024-01-15")
        result_hist = await converter.convert(100, "USD", "EUR", "2024-01-15")
        print(f"  Result: {result_hist.amount} {result_hist.to_ccy} (rate: {result_hist.rate} on {result_hist.date})")
        
    except Exception as e:
        print(f"  Error: {e}")
    
    print("\nCurrency conversion test completed!")

if __name__ == "__main__":
    asyncio.run(test_currency_conversion())
