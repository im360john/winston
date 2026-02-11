# Inventory Lookup Skill

Check product inventory levels from connected POS system.

## Description

This skill allows the agent to look up current inventory levels for products in the dispensary's POS system (Treez, Dutchie, Blaze, etc.).

## Usage

The agent can call this skill when customers or staff ask about:
- Product availability ("Do you have Blue Dream in stock?")
- Quantity levels ("How much Wedding Cake do we have left?")
- Low stock alerts ("What products are running low?")

## Parameters

- `productName` (required): Name of the product to look up
- `location` (optional): Specific store location (for multi-location operators)
- `threshold` (optional): For low stock queries (default: 10 units)

## Example

**User:** "Do we have any Gelato in stock?"

**Agent calls skill:**
```json
{
  "productName": "Gelato",
  "location": "Oakland"
}
```

**Skill returns:**
```json
{
  "product": "Gelato",
  "inStock": true,
  "quantity": 24,
  "unit": "eighths",
  "location": "Oakland",
  "lastUpdated": "2026-02-11T10:30:00Z"
}
```

**Agent responds:** "Yes! We have 24 eighths of Gelato in stock at our Oakland location."

## Setup

Requires POS connector configured (Treez/Dutchie/Blaze API key).

## Access Level

Read-only by default. Does not modify inventory.
