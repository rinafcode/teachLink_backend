# Subprocessor Register

This register lists the subprocessors — third parties that process data on
behalf of TeachLink Backend — together with what data they process, where
they are located, and how data subjects and customers are notified when the
list changes. It exists so the project can answer "who touches our data"
without an investigation.

This document is part of the project's **Compliance** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## Subprocessor Fields

Each entry in the register carries these fields:

| Field | Meaning |
|---|---|
| Subprocessor | Legal name of the party and a link to their terms. |
| Purpose | What processing is outsourced to them, in one line. |
| Data categories | Categories of personal data processed (e.g. account identifiers, logs, payment metadata). |
| Location | Country (or region) where the data is stored or processed. |
| Flow | Whether data is stored at rest, processed only, or both. |
| Contract | Reference to the agreement or DPA covering the processing. |
| Last verified | Date the entry was last confirmed with the current architecture. |

## Register

| Subprocessor | Purpose | Data categories | Location | Flow | Contract | Last verified |
|---|---|---|---|---|---|---|
| *(entries added as integrations are adopted)* | | | | | | |

## Data Categories And Location

- **Data categories** are stated at the category level ("email addresses",
  "diagnostic logs"), never as "all data". If a subprocessor's access
  cannot be described in categories, it is not recorded as approved.
- **Location** records where processing happens, not where the vendor is
  incorporated; if the location changes, the entry is updated even when
  the vendor's terms are unchanged.
- Any entry whose location falls outside the project's approved regions is
  flagged for a compliance decision before first use.

## Change Notification Process

1. The owner of an affected integration confirms the change (new
   subprocessor, removed subprocessor, or change of location or data
   categories) in writing with the vendor.
2. The entry is updated in this register in the same pull request that
   records the change; the register is the source of truth, not the vendor's
   page.
3. A change that adds a subprocessor, moves processing to a new region, or
   broadens data categories is announced to affected users through the
   project's public channels **before the change takes effect**, with a
   reasonable notice period as required by the project's agreements.
4. Removals are recorded with the date of removal, not deleted — the entry
   becomes the historical record of processing that already occurred.
5. Each change is logged in the entry's **Last verified** field and, when
   material, in the review notes of the next governance review.
