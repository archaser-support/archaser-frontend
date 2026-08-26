---
name: Custom Priority table pull
overview: "Honor a connector's chosen Priority table by discovering its columns at pull time. Intersect $select, pick sort/date from what exists (optional admin date field on the mapping row). Do not hardcode IDG_ARFNCITEMS4 in core or in the account 10149 extension."
todos:
  - id: table-shape-helper
    content: Pure resolveTablePullShape — intersect select, order-by candidates, date field, filter field check
    status: pending
  - id: live-discover-pull
    content: PriorityProviderClient samples the table once per entity, reshapes the GET, fails on zero columns / unknown filter fields
    status: pending
  - id: pull-date-field
    content: ConnectorFieldMapping.pull_date_field + mapping GET/PUT + mapper dropdown
    status: pending
  - id: remove-hardcode
    content: Remove isArFinancialItemsEntitySet omit/orderBy/FNCDATE shortcuts
    status: pending
isProject: false
---

See `archaser-backend/.cursor/plans/custom_priority_table_pull.plan.md` for the full plan. Frontend touch: mapping date-field dropdown and mapping API payload.
