# Design Guidelines: Minimal React Webapp Base

## Design Approach
**Selected Approach:** Utility-Focused Design System (Material Design Lite principles)

This is a clean foundation template, not a feature-complete application. Design prioritizes simplicity, clarity, and easy customization.

## Core Design Elements

### Typography
- **Primary Font:** Inter (via Google Fonts CDN)
- **Hierarchy:**
  - Headers: font-semibold, text-2xl to text-4xl
  - Body: font-normal, text-base
  - Small text: text-sm
- **Line Height:** leading-relaxed for body, leading-tight for headers

### Layout System
- **Spacing Units:** Use Tailwind units of 4, 6, and 8 consistently (p-4, m-6, gap-8)
- **Container:** max-w-7xl mx-auto px-4
- **Grid:** Simple single-column layout, stack elements vertically
- **Breakpoints:** Responsive but minimal - focus on mobile-first

### Component Library

**Minimal Header**
- Simple navigation bar
- Logo/title on left
- Optional nav links on right
- Sticky positioning (sticky top-0)
- Clean border-bottom separation

**Main Content Area**
- Centered container with comfortable max-width
- Generous padding (py-8 to py-12)
- Breathing room between sections (space-y-8)

**Footer** (Optional)
- Minimal copyright/info text
- Centered or left-aligned
- Subtle border-top

**Buttons** (when needed)
- Rounded corners (rounded-lg)
- Comfortable padding (px-6 py-3)
- Clear font-weight (font-medium)

### Visual Treatment
- **Background:** Clean, solid background
- **Borders:** Subtle, minimal use (border-gray-200 equivalent)
- **Shadows:** None or very subtle (shadow-sm)
- **Whitespace:** Generous - let content breathe

### Animations
None. Keep it static and performant.

## Images
**No hero image.** This is a blank template - any images would be placeholder-only for demonstration purposes.

## Key Principles
1. **Minimal by design** - Less is more
2. **Easy to extend** - Clean structure ready for customization
3. **No opinions** - Neutral foundation that works for any project direction
4. **Performance first** - No unnecessary elements or complexity

This creates a professional, clean canvas that developers can immediately build upon without fighting existing design decisions.