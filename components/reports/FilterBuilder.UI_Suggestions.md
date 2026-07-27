# FilterBuilder UI Design Suggestions

This document outlines several alternative UI designs for the filters section in FilterBuilder.tsx.

## Current Design
- Horizontal layout with all filter components in a single row
- Table → Field → Operator → Value → Delete button
- All filters displayed in a flat list

## Design Option 1: Card-Based Layout with Vertical Stacking

**Benefits:**
- Better visual separation between filters
- More space for complex value inputs
- Better mobile responsiveness
- Clearer hierarchy

**Layout:**
```
┌─────────────────────────────────────────┐
│ Add Filters                    [+ Add]  │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Table: Customer  [×]                │ │
│ │ Field: Name                         │ │
│ │ Operator: Contains                  │ │
│ │ Value: [Text Input]                 │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Table: Invoice  [×]                 │ │
│ │ Field: Amount                       │ │
│ │ Operator: Greater Than              │ │
│ │ Value: [Number Input]               │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Design Option 2: Compact Chip-Based with Expandable Details

**Benefits:**
- Space-efficient
- Quick overview of all filters
- Expand to edit details
- Modern, clean appearance

**Layout:**
```
┌─────────────────────────────────────────┐
│ Add Filters                    [+ Add]  │
├─────────────────────────────────────────┤
│ Customer.Name Contains "John"      [×]  │
│ Invoice.Amount > 1000              [×]  │
│ ┌─────────────────────────────────────┐ │
│ │ Customer.Status = Active        [×] │ │
│ │   Table: Customer                    │ │
│ │   Field: Status                      │ │
│ │   Operator: Equals                  │ │
│ │   Value: Active                     │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Design Option 3: Two-Column Grid Layout

**Benefits:**
- Better use of horizontal space
- Can fit more filters in view
- Good for wide screens
- Maintains horizontal flow

**Layout:**
```
┌─────────────────────────────────────────┐
│ Add Filters                    [+ Add]  │
├─────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐     │
│ │ Customer     │  │ Invoice      │     │
│ │ Name         │  │ Amount      │     │
│ │ Contains     │  │ > 1000      │ [×] │
│ │ [Input]      │  │              │     │
│ └──────────────┘  └──────────────┘     │
│ ┌──────────────┐  ┌──────────────┐     │
│ │ Customer     │  │              │     │
│ │ Status       │  │              │     │
│ │ = Active     │  │              │ [×] │
│ │              │  │              │     │
│ └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────┘
```

## Design Option 4: Accordion/Collapsible Filters

**Benefits:**
- Can collapse filters to save space
- Group filters by table
- Easy to focus on specific filters
- Good for many filters

**Layout:**
```
┌─────────────────────────────────────────┐
│ Add Filters                    [+ Add]  │
├─────────────────────────────────────────┤
│ ▼ Customer Filters (2)                  │
│   ┌───────────────────────────────────┐ │
│   │ Name Contains "John"          [×] │ │
│   │ Status = Active               [×] │ │
│   └───────────────────────────────────┘ │
│ ▶ Invoice Filters (1)                    │
│ ▶ Activity Filters (0)                    │
└─────────────────────────────────────────┘
```

## Design Option 5: Inline Form with Visual Connectors

**Benefits:**
- Shows filter relationships clearly
- Visual "AND" connectors between filters
- Professional appearance
- Easy to understand logic

**Layout:**
```
┌─────────────────────────────────────────┐
│ Add Filters                    [+ Add]  │
├─────────────────────────────────────────┤
│ Customer.Name Contains "John"      [×] │
│            AND                          │
│ Invoice.Amount > 1000              [×] │
│            AND                          │
│ Customer.Status = Active          [×] │
└─────────────────────────────────────────┘
```

## Design Option 6: Modal/Dialog for Filter Creation

**Benefits:**
- Clean main view
- Focused filter creation experience
- Can preview filter before adding
- Less cluttered interface

**Layout:**
```
Main View:
┌─────────────────────────────────────────┐
│ Add Filters                    [+ Add]  │
├─────────────────────────────────────────┤
│ Active Filters (3)                       │
│ • Customer.Name Contains "John"    [×] │
│ • Invoice.Amount > 1000            [×] │
│ • Customer.Status = Active         [×] │
└─────────────────────────────────────────┘

Modal (when clicking [+ Add]):
┌─────────────────────────────────────────┐
│ Create New Filter                  [×]  │
├─────────────────────────────────────────┤
│ Table: [Customer ▼]                     │
│ Field: [Name ▼]                         │
│ Operator: [Contains ▼]                  │
│ Value: [Text Input]                     │
│                                         │
│ Preview: Customer.Name Contains ""      │
│                                         │
│ [Cancel]  [Add Filter]                  │
└─────────────────────────────────────────┘
```

## Design Option 7: Stepped/Wizard Filter Builder

**Benefits:**
- Guided experience
- Step-by-step validation
- Good for complex filters
- Clear progression

**Layout:**
```
┌─────────────────────────────────────────┐
│ Add Filters                    [+ Add]  │
├─────────────────────────────────────────┤
│ Step 1: Select Table                   │
│ [Customer] [Invoice] [Activity]        │
│                                         │
│ Step 2: Select Field                    │
│ [Name ▼]                                │
│                                         │
│ Step 3: Select Operator                 │
│ [Contains ▼]                            │
│                                         │
│ Step 4: Enter Value                     │
│ [Text Input]                            │
│                                         │
│ [Back] [Add Filter]                     │
└─────────────────────────────────────────┘
```

## Design Option 8: Sidebar Filter Panel

**Benefits:**
- Dedicated space for filters
- Can keep filters visible while viewing results
- Professional dashboard feel
- Easy to toggle visibility

**Layout:**
```
┌──────────┬─────────────────────────────┐
│ Filters  │ Report Results               │
│          │                              │
│ [+ Add]  │                              │
│          │                              │
│ Customer │                              │
│ Name     │                              │
│ Contains │                              │
│ [Input]  │                              │
│ [×]      │                              │
│          │                              │
│ Invoice  │                              │
│ Amount   │                              │
│ > 1000   │                              │
│ [×]      │                              │
└──────────┴─────────────────────────────┘
```

## Recommended Implementation Priority

1. **Option 1 (Card-Based)** - Best balance of clarity and space
2. **Option 2 (Chip-Based)** - Most modern and space-efficient
3. **Option 5 (Visual Connectors)** - Best for showing filter logic
4. **Option 4 (Accordion)** - Best for many filters

## Implementation Notes

- All designs should maintain RTL support
- Responsive breakpoints for mobile/tablet
- Maintain accessibility (keyboard navigation, ARIA labels)
- Keep existing functionality intact
- Consider adding filter groups/OR logic in future






