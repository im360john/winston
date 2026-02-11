# Sales Summary Skill

Generate sales performance reports from POS data.

## Description

This skill allows the agent to generate sales summaries and reports for dispensary staff. Analyzes POS data to provide insights on revenue, top products, and trends.

## Usage

The agent can call this skill when staff ask about:
- Daily/weekly/monthly sales totals
- Top-selling products
- Revenue by category
- Sales trends and comparisons

## Parameters

- `period` (required): "today", "yesterday", "week", "month", or date range
- `metric` (optional): "revenue", "units", "transactions", "average_order"
- `groupBy` (optional): "product", "category", "hour"

## Example

**User:** "What were our total sales yesterday?"

**Agent calls skill:**
```json
{
  "period": "yesterday",
  "metric": "revenue"
}
```

**Skill returns:**
```json
{
  "period": "2026-02-10",
  "totalRevenue": 8450.32,
  "transactions": 156,
  "averageOrder": 54.17,
  "topProducts": [
    {"name": "Blue Dream", "revenue": 1240.00},
    {"name": "Sour Diesel", "revenue": 980.50}
  ]
}
```

**Agent responds:** "Yesterday's sales totaled $8,450.32 across 156 transactions, with an average order of $54.17. Top sellers were Blue Dream ($1,240) and Sour Diesel ($980)."

## Setup

Requires POS connector with read access to sales data.

## Access Level

Read-only. Staff only (not customer-facing).

## Privacy

Does not expose individual customer data. All summaries are aggregated.
