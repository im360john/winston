# Social Media Post Generator

Help staff create engaging social media content about products and promotions.

## Description

This skill helps dispensary staff generate social media posts for Instagram, Facebook, Twitter, etc. Suggests captions, hashtags, and post ideas based on new products, promotions, or inventory.

## Usage

The agent can call this skill when staff ask for help with:
- Product announcement posts
- Promotional campaign ideas
- Strain highlight posts
- Educational content

## Parameters

- `postType` (required): "product_announcement", "promotion", "education", "engagement"
- `subject` (optional): Product name or topic
- `tone` (optional): "fun", "professional", "educational"
- `platform` (optional): "instagram", "facebook", "twitter"

## Example

**User:** "Write me an Instagram post about our new Gelato strain"

**Agent calls skill:**
```json
{
  "postType": "product_announcement",
  "subject": "Gelato",
  "platform": "instagram",
  "tone": "fun"
}
```

**Skill returns:**
```json
{
  "caption": "🍨 NEW ARRIVAL: Gelato 🍨\n\nSweet, creamy, and oh-so-smooth. Our premium Gelato is here and it's everything you've been waiting for. Stop by today!\n\n✨ Indica-dominant hybrid\n🍇 Sweet berry & citrus notes\n😌 Perfect for relaxation\n\n#Gelato #NewStrains #CannabisLife #Dispensary #OaklandCannabis",
  "hashtags": ["#Gelato", "#NewStrains", "#CannabisLife", "#Dispensary"],
  "suggestions": [
    "Include a close-up photo of the flower",
    "Post during peak hours (4-7pm)",
    "Consider a Story poll: Indica or Sativa fan?"
  ]
}
```

## Setup

No special setup required. Works out of the box.

## Access Level

Staff only. Not available to customers.

## Guidelines

- Always follows cannabis advertising regulations
- Never makes medical claims
- Age-appropriate content (21+)
- Platform-specific best practices
