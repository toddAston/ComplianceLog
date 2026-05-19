# FieldLog

**Mobile-first, offline pesticide application recordkeeping for agricultural operations. Captures audit-ready records with applicator details, field info, products, weather, and manager review—fully Missouri and federally compliant.**

---

## Overview

FieldLog is an offline-capable mobile application designed to help agricultural operations capture and manage pesticide application records with full audit trails. It enables contractors and applicators to log spray applications in the field in real-time, with managers able to review and attest to records for regulatory compliance.

### Core Problem Solved

Pesticide application records are often scattered across texts, spreadsheets, paper notes, photos, weather apps, and memory. FieldLog centralizes this evidence in a single, audit-ready format that satisfies state and federal recordkeeping requirements.

### System Framing

```
FieldLog = Application Record spine + offline capture + manager review + immutable evidence/export
```

---

## Features

- **Offline-First Mobile App** — Contractors record applications in the field without requiring internet connectivity
- **Golden Happy Path** — Simple, linear workflow: select farm → select field → select product → enter details → attest → submit → manager review → locked record
- **Complete Application Records** — Capture all mandatory fields per Missouri regulation (applicator, field, product, application details, weather, conditions)
- **Manager Review Workflow** — Managers review submitted records for accuracy and compliance before locking
- **Audit-Ready Exports** — Generate compliance-ready reports with full metadata and evidence chains
- **System Audit Logging** — Automatic capture of system-level metadata for regulatory inspection
- **Weather Integration** — Capture or record environmental conditions (temperature, wind speed/direction)

---

## Application Record Structure

Every application record contains:

```
Application Record
├── Applicator (name, company, certification #)
├── Field / Site (farm, field, crop/site, acres treated)
├── Product (name, EPA registration #, rate, amount)
├── Application Details (date, time, pest target, weather)
├── Attestation (contractor signature/confirmation)
├── Manager Review (approval status, comments)
├── System Audit Metadata (timestamps, user log, changes)
└── Evidence Attachments (planned for future release)
```

---

## Regulatory Compliance

FieldLog captures records compliant with:

- **Missouri Rev. Stat. §281.035** — Certified commercial applicator recordkeeping
- **Missouri Rev. Stat. §281.037** — Certified noncommercial applicator recordkeeping (RUP)
- **Missouri Rev. Stat. §281.045** — Public operator recordkeeping (RUP)
- **2 CSR 70-25.120** — Application record content and timing requirements
- **40 CFR 171.304(f)(6)(vi)** — Federal certification plan requirements

### Record Requirements

Records must include (A–M per Missouri regulation):
- Certified applicator name/license
- Noncertified applicator or technician name
- Application date and time (start/end)
- Requesting party name/address
- Application site address/description
- Area treated (acres)
- Crop/site/commodity
- Target pest(s)
- Pesticide trade name(s)
- EPA registration # and special-use #
- Mixture rate and total amount applied
- Air temperature, wind speed and direction (outdoor use)

### Timing & Retention

- **Completion:** Records must be completed within **3 business days** of application
- **Retention:** Records must be kept for **at least 3 years**
- **Inspection:** Records available for regulatory inspection on request

---

## Project Status

**Current Version:** v0.1 (Design & Specification)

**MVP Scope:**  
Narrow, fully working application capturing all mandatory record fields without over-claiming compliance.

**Architecture:**
- **Frontend:** Mobile-first (iOS/Android ready), offline-capable
- **Backend:** (To be determined based on MVP decisions)
- **Data Model:** Reproducible, database-agnostic format
- **Workflow:** Contractor capture → Manager review → Export

---

## Getting Started

*(Development environment and build instructions to be added as the project progresses)*

---

## Project Documents

- [FieldLog Reproducible Design Snapshot](fieldlog_reproducible_design_v0_1.md) — Complete design specification and data model
- [FieldLog Development Blueprint](FieldLog%20Development%20Blueprint.md) — Regulatory analysis, feature design, and architecture
- [Mermaid Diagrams](fieldlog_mermaid_diagrams_v0_1.mmd) — Visual flowcharts and system diagrams
- [Design Model](fieldlog_design_model_v0_1.json) — JSON schema for the application record

---

## Data Sources

This project includes publicly available regulatory data:
- **2024 CDR Data Files** — Chemical Data Reporting for pesticide manufacture, import, and industrial use information from the EPA

---

## Contributing

*(Contribution guidelines to be established)*

---

## License

*(License to be determined)*

---

## Contact & Support

For questions, regulatory compliance concerns, or feature requests, please [contact the project team].

---

**Last Updated:** May 19, 2026  
**Project Phase:** Specification & Design (v0.1)
