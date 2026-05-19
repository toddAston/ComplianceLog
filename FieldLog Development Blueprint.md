# FieldLog Development Blueprint

This document provides a comprehensive development plan for **FieldLog**, a mobile-first pesticide application recordkeeping platform. It covers legal requirements, data modeling, feature design, architecture, and demo planning. The goal is a **narrow, fully working MVP** that helps agricultural managers capture and audit pesticide use records in compliance with Missouri and federal law, without over-claiming compliance.  

## 1. Regulatory Source Map

| **Source Name**                          | **Jurisdiction**       | **URL/Citation**                                                  | **Governs**                                       | **Affected Feature**                       | **Data Fields Required**             | **Validation Logic**                                                         | **Type**                      |
|------------------------------------------|------------------------|-------------------------------------------------------------------|---------------------------------------------------|--------------------------------------------|-------------------------------------|-----------------------------------------------------------------------------|-------------------------------|
| Missouri Rev. Stat. §281.035 (2025)      | Missouri state law     | RSMo 281.035【5†L151-L158】                                        | Recordkeeping for certified commercial applicators| Record retention, mandatory logging       | Not specific (director to specify) | Must record all pesticide applications; retain 3 years【5†L151-L158】         | Primary statute               |
| Missouri Rev. Stat. §281.037 (2025)      | Missouri state law     | RSMo 281.037(9)【39†L137-L144】                                     | Recordkeeping for certified noncommercial applicators (RUP only) | RUP record retention                   | Not specific (by regulation)       | Must record RUP applications; retain 3 years【39†L137-L144】                  | Primary statute               |
| Missouri Rev. Stat. §281.045 (2025)      | Missouri state law     | RSMo 281.045(8)【41†L136-L143】                                     | Recordkeeping for certified public operators (RUP only) | Public operator RUP records         | Not specific (by regulation)       | Must record RUP applications; retain 3 years【41†L136-L143】                  | Primary statute               |
| Missouri Rev. Stat. §281.050 (2025)      | Missouri state law     | RSMo 281.050(6)【10†L132-L140】                                     | Dealer recordkeeping for RUP sales                | (Not core FieldLog)                      | Not specific (by regulation)       | Dealers must record RUP sales; retain 3 years【10†L132-L140】                | Primary statute               |
| 2 CSR 70-25.120 (Effective 1/1/2025)     | Missouri regulation    | Mo. Code Regs. 2 CSR 70-25.120【7†L87-L95】【7†L104-L113】          | Applicator record content & timing               | Application log fields, timing, retention | Fields (A–N)【7†L104-L113】【7†L131-L139】; timestamps; area, weather, etc. | Required fields A–N; complete within 3 business days; keep 3 years【7†L87-L95】 | Administrative regulation     |
| 2 CSR 70-25.180 (Eff. 1/1/2025)          | Missouri regulation    | Mo. Code Regs. 2 CSR 70-25.180【38†L81-L90】【38†L92-L101】         | Dealer record content & timing                   | Dealer sales log (RUP)                 | Dealer name/ID; product name/ EPA#; amount; buyer info【38†L81-L90】【38†L92-L101】 | Records within 3 days; keep 3 yrs【38†L81-L90】                             | Administrative regulation     |
| 7 CFR Part 110 (rescind 2025)            | Federal (USDA)         | 7 CFR 110 (was federal RUP recordkeeping)【16†L199-L207】【25†L104-L113】 | Federal RUP recordkeeping (private applicators)   | RUP application log                     | 9 elements (product, EPA#, amount, date, location, crop, area, applicator name/ID)【16†L199-L207】 | Record within 14 days; keep 2 years【16†L199-L207】【25†L104-L113】        | Federal regulation (rescinded July 2025) |
| 40 CFR 171 (EPA cert. plans)             | Federal (EPA/CFR)      | 40 CFR 171.304(f)(6)(vi)【21†L2777-L2785】                          | Federal certification plan requirements          | Commercial applicator RUP records      | Fields: client name, location, area, crop, date/time, product, EPA#, amount, applicator name/ID【21†L2777-L2785】 | Keep ≥2 years; available to state officials【21†L2777-L2785】             | Federal regulation (model reg)|
| FIFRA §§ 12(a)(2)(G),13               | Federal law (EPA)      | 7 U.S.C. §§136k,136l                                               | Pesticide labeling as law, legal liability        | (General compliance concept)          | n/a                                 | Use only as labeled; label is enforceable; violation = prohibited use     | Federal statute               |
| EPA Pesticide Label (various)           | Product-specific       | EPA PPLS (e.g. https://iaspub.epa.gov/apex/pesticides/f?p=PPLS:1)   | Pesticide-specific use instructions & restrictions| Data for Product entities, compliance | Crop/site, rate, pests from label    | FieldLog should link product to label to check off-label use               | Agency guidance/tool          |

> **Note:** “Application log fields” refers to detailed application information (see 2 CSR 70‑25.120). “Timing” refers to how quickly after application the record must be completed. These sources drive which fields FieldLog must capture and flags it should generate【7†L87-L95】【7†L104-L113】. All Missouri statutes and regulations are **primary law**. USDA/EPA sources are federal law or agency guidance. University or extension materials (e.g.【22†L58-L66】) are **secondary** interpretation and used here for clarity, not definitive rules.

## 2. Legal Requirement Extraction

Below are extracted recordkeeping requirements affecting pesticide applications. Each is labeled (R1, R2, etc.) and includes the exact source. Fields and timing are derived from the rules and laws.

- **R1: Certified Commercial Applicator Recordkeeping**  
  - **Source:** RSMo §281.035(7)【5†L151-L158】 and 2 CSR 70‑25.120(1)【7†L87-L95】.  
  - **Summary:** *Each certified commercial pesticide applicator (or employer) must keep records of every pesticide application (any class) they make or supervise. Records must be completed within 3 business days of use, kept at least 3 years, and made available to state inspectors on request*.  
  - **Fields:** See R4. Statute says “relevant information as director may deem necessary.” Reg specifies fields (name/license of applicator, date/time, client info, site, area, crop, pest, product trade names and EPA #, amount, rate, weather, etc.)【7†L104-L113】【21†L2777-L2785】.  
  - **Timing:** Record filled in *≤3 business days* after application【7†L87-L95】.  
  - **Retention:** Keep records ≥3 years【5†L151-L158】【7†L87-L95】.  
  - **Who Keeps:** Certified commercial applicator or their employer【5†L151-L158】.  
  - **Inspection:** Records on-site, or copy to director within 10 days of request【7†L98-L102】.  
  - **Applicator Types:** Missouri **certified commercial** (both general- and restricted-use pesticides).  
  - **Jurisdiction:** Missouri.  
  - **Confidence:** High (statute and rule clear).  
  - **Notes:** “Relevant information” is fleshed out by 2 CSR 70‑25.120. The app should enforce the reg fields; RSMo 281.035 alone is vague.

- **R2: Certified Noncommercial Applicator Recordkeeping (RUP only)**  
  - **Source:** RSMo §281.037(9)【39†L137-L144】 and 2 CSR 70‑25.120(2)【7†L92-L96】.  
  - **Summary:** *Certified noncommercial applicators (e.g. farmers applying RUPs on their own land) or their employers must keep records of each restricted-use pesticide application. Records must be done within 3 business days and kept 3 years.*  
  - **Fields:** Same required fields as R1 for each RUP use (see R4)【7†L104-L113】.  
  - **Timing:** Complete within 3 business days of RUP use【7†L92-L96】.  
  - **Retention:** Keep ≥3 years【39†L137-L144】【7†L92-L96】.  
  - **Who Keeps:** Certified noncommercial applicator or employer【39†L137-L144】.  
  - **Inspection:** As R1. Copy to director on 10-day notice【39†L137-L144】.  
  - **Applicator Types:** Missouri **certified noncommercial** (only RUP use).  
  - **Jurisdiction:** Missouri.  
  - **Confidence:** High.  
  - **Notes:** Federal private applicators would have similar fields (see R9), but state law focuses on RUPs for noncommercial.

- **R3: Certified Public Operator Recordkeeping (RUP only)**  
  - **Source:** RSMo §281.045(8)【41†L136-L143】 and 2 CSR 70‑25.120(2)【7†L92-L96】.  
  - **Summary:** *Certified public operators (government agencies) must keep records of each restricted-use pesticide application. Same 3-day completion and 3-year retention apply.*  
  - **Fields:** Same as R4 for each RUP use.  
  - **Timing:** ≤3 business days per RUP use【7†L92-L96】.  
  - **Retention:** ≥3 years【41†L136-L143】【7†L92-L96】.  
  - **Who Keeps:** Certified public operator or employer【41†L136-L143】.  
  - **Inspection:** As R1/R2.  
  - **Applicator Types:** Missouri **certified public operators** (governmental) for RUPs.  
  - **Jurisdiction:** Missouri.  
  - **Confidence:** High.  
  - **Notes:** Identical treatment to noncommercial RUP recordkeeping.

- **R4: Required Record Fields (Applicators)**  
  - **Source:** 2 CSR 70‑25.120(4)【7†L104-L113】【7†L131-L139】.  
  - **Summary:** *Every pesticide application record (per above applicator) must include: (A) name/license # of certified applicator, (B) name/license of noncertified applicator or technician involved, (C) application date, start/end time, (D) name/address of person requesting use, (E) address or description of application site, (F) area treated, (G) crop/site/commodity, (H) target pest(s), (I) pesticide trade name(s), (J) EPA registration # and special-use #, (K) mixture rate and total amount applied, (L) estimate and actual rate for pre-mixed products, (M) air temp, wind speed and direction for outdoor uses (excl. minor indoor), (N) signed written request if using lower concentration than label.*  
  - **Fields (required):** The app’s data model and forms must capture at minimum all fields (A)–(M) for each application【7†L104-L113】【7†L131-L139】.  
  - **Timing/Retention:** These fields go into each record which obeys 3-day/two policies (R1–R3).  
  - **Who Must Include:** Certified applicators (commercial, noncommercial, public) for all pesticides (cert. comm.) or RUP (others).  
  - **Applicator Types:** Applies as specified in R1–R3.  
  - **Jurisdiction:** Missouri regulation.  
  - **Confidence:** High (explicit rule).  
  - **Notes:** These fields create **required data inputs** in FieldLog. The app’s validation logic should enforce nonempty values for (A)–(M) as applicable (unless legitimately N/A). Field (N) is conditional. 

- **R5: Record Completion Timing**  
  - **Source:** 2 CSR 70‑25.120(1)–(2)【7†L87-L96】.  
  - **Summary:** *Applicators must complete records within 3 business days of the pesticide use date.*  
  - **Fields:** N/A (timing requirement).  
  - **Timing:** ≤3 business days after application date【7†L87-L95】.  
  - **Retention:** Covered by retention rules (3 yrs).  
  - **Applicator Types:** Certified commercial (all pesticides), certified noncommercial/public (RUP).  
  - **Jurisdiction:** Missouri.  
  - **Confidence:** High.  
  - **Notes:** FieldLog should flag a record as “past due” if not completed in 3 days. 

- **R6: Record Retention**  
  - **Source:** RSMo §281.035(7)【5†L151-L158】, RSMo §281.037(9)【39†L137-L144】, RSMo §281.045(8)【41†L136-L143】, 2 CSR 70‑25.120【7†L87-L95】.  
  - **Summary:** *Applicators (per R1–R3) must keep pesticide application records for **at least 3 years** from the date of application*. Dealers keep sales records 3 years【38†L81-L90】.  
  - **Fields:** N/A.  
  - **Timing:** Records dated, retention timed from that date.  
  - **Who Keeps:** Certified applicators, dealers.  
  - **Jurisdiction:** Missouri.  
  - **Confidence:** High.  
  - **Notes:** FieldLog should tag date and calculate retention deadlines for archiving/purging.

- **R7: Inspection Access**  
  - **Source:** 2 CSR 70‑25.120(3)【7†L98-L102】.  
  - **Summary:** *Records must be available for inspection at the applicator’s business during normal hours. Upon written request, a copy of records must be provided within 10 days.*  
  - **Fields:** N/A.  
  - **Who Inspects:** Department director or authorized agents.  
  - **Jurisdiction:** Missouri.  
  - **Applicator Types:** All certified applicators per R1–R3.  
  - **Confidence:** High.  
  - **Notes:** FieldLog’s “audit export” facilitates this. The app should allow exporting records on demand【7†L98-L102】.

- **R8: Dealer Recordkeeping (Restricted Use Sales)**  
  - **Source:** 2 CSR 70‑25.180(1)–(3)【38†L81-L90】【38†L92-L101】.  
  - **Summary:** *Pesticide dealers must record each restricted-use pesticide sale or distribution within 3 business days and keep those records 3 years. Records must include: dealer name/license, product trade name(s)/EPA#(s)/state registration, amount sold and date; and buyer information (name, address, license/certification and related details)【38†L90-L101】.*  
  - **Fields:** Dealer name/license; product trade name/EPA#/SLN; amount; transaction date; buyer name, address, license#, cert category, cert agency, license expiry; authorized rep name/relationship if applicable【38†L92-L101】.  
  - **Timing:** ≤3 business days after sale【38†L81-L90】.  
  - **Retention:** ≥3 years【38†L81-L90】.  
  - **Who Keeps:** Licensed pesticide dealers【38†L81-L90】.  
  - **Applicator Types:** Dealers (though FieldLog is for applicators, not dealers).  
  - **Jurisdiction:** Missouri.  
  - **Confidence:** High.  
  - **Notes:** FieldLog could optionally import dealer sale data; at minimum, it should store product EPA and sale date to link uses back to sales. Not a core applicator requirement, so lower priority (see **MVP Cut Features** below).

- **R9: Federal Private Applicator RUP Recordkeeping**  
  - **Source:** USDA AMS, 7 CFR Part 110 (rescinded Jul 2025)【16†L199-L207】【25†L104-L113】.  
  - **Summary:** *Historically, all certified private applicators (farmers) were required to record federally restricted-use pesticide applications, maintaining 9 specific data items for 2 years after application. (This federal rule is being rescinded in 2025.)*  
  - **Fields:** Brand/product name, EPA reg. #, amount applied, date (month/day/year), location of application, crop/commodity/site, area treated, applicator name, applicator certification #【16†L199-L207】.  
  - **Timing:** Record within 14 days of application【16†L199-L207】.  
  - **Retention:** 2 years【16†L199-L207】.  
  - **Who Keeps:** Private certified applicators (farmers) of RUPs.  
  - **Applicator Types:** Federal **private** applicators.  
  - **Jurisdiction:** Federal (USDA).  
  - **Confidence:** *Medium.* (The rule was binding until mid-2025; may no longer be enforced, but many states still consider similar requirements.)  
  - **Notes:** Even if rescinded, including these fields does no harm. FieldLog can treat this as “federal guideline” – flag if missing but note federal status. (State law did not impose RUP records on private applicators beyond federal.)

- **R10: Federal Commercial Applicator RUP Records**  
  - **Source:** 40 CFR 171.304(f)(6)(vi)【21†L2777-L2785】 (State certification plan requirement).  
  - **Summary:** *Federal law (via state certification plan) requires certified commercial applicators to maintain RUP use records for ≥2 years, including: customer name/address, location, area, crop, date/time, product name, EPA #, amount, and applicator name/ID【21†L2777-L2785】.*  
  - **Fields:** Same core fields as R4 (subset for RUPs)【21†L2777-L2785】.  
  - **Retention:** ≥2 years【21†L2777-L2785】.  
  - **Who Keeps:** Certified commercial applicators (federal standard).  
  - **Applicator Types:** Commercial (agricultural and non-ag) for RUP.  
  - **Jurisdiction:** Federal/FIFRA.  
  - **Confidence:** Medium. (State of Missouri exceeds this with 3-year rule【5†L151-L158】.)  
  - **Notes:** FieldLog will satisfy this by doing 3-year retention and capturing the fields.

> **Uncertainties:** Items R9–R10 involve federal rules that have recently changed (e.g. rescission of private recordkeeping). FieldLog should *flag* missing data but treat strict legal compliance as requiring human review. All extracted fields and timing requirements above should be treated as “driving rules,” but any gray area must be documented with source citations and confidence levels.

## 3. Canonical Compliance Data Model

Below is the core data model for FieldLog, listing key entities, their purpose, fields, and relationships. Bold fields are **legally required** by the above rules; others support functionality. 

### Entities and Attributes

- **Organization** – An agricultural operation (farm, company).  
  - *Fields:* `orgId`, `name`, `address`, `contactInfo`.  
  - *Type:* e.g. string, address.  
  - *Required:* `name` (yes), others optional.  
  - *Validation:* None legally required; basic nonempty name.  
  - *Example:* `{"orgId": "ORG123", "name": "Acme Farms", "address": "123 Main St", "contact": "manager@example.com"}`.  
  - *Editable:* Yes.  
  - *Audit:* Included in export.

- **User** – A person who can log into FieldLog (manager or contractor).  
  - *Fields:* `userId`, `name`, `email`, `roleId`, `organizationId`.  
  - *Type:* string, email.  
  - *Required:* `name`, `email` (yes).  
  - *Validation:* Email format; unique email.  
  - *Example:* `{"userId": "U456", "name": "Jane Doe", "email": "jane@example.com", "roleId": "manager", "organizationId": "ORG123"}`.  
  - *Editable:* Yes (except `roleId`).  
  - *Audit:* Not in application record export.

- **Role** – Defines user permissions.  
  - *Fields:* `roleId` (e.g. manager, contractor), `description`.  
  - *Type:* string.  
  - *Required:* `roleId`.  
  - *Validation:* Must be one of predefined roles.  
  - *Example:* `{"roleId": "contractor", "description": "Field applicator recording sprays"}`.  
  - *Editable:* Only by admin.  
  - *Audit:* N/A.

- **Contractor** – External applicator company/individual under contract.  
  - *Fields:* `contractorId`, `name`, `licenseNumber`, `licenseExpiration`, `certifiedTypes` (categories), `organizationId`.  
  - *Type:* string, date, list.  
  - *Required:* `name`, `licenseNumber`.  
  - *Validation:* License number format; expiration date ≥ today.  
  - *Example:* `{"contractorId": "C789", "name": "GoodSpray Inc", "licenseNumber": "MOC-12345", "licenseExpiration": "2025-12-31", "certifiedTypes": ["Category 3A"], "organizationId": "ORG123"}`.  
  - *Editable:* Yes (pre-submission).  
  - *Audit:* Included in export (contractor info).

- **Applicator** – Individual who performs application (may or may not be same as contractor).  
  - *Fields:* `applicatorId`, `name`, `licenseNumber`, `licenseType` (commercial, noncommercial, private, etc.), `licenseExpiration`.  
  - *Type:* string, date.  
  - *Required:* `name`, `licenseNumber`.  
  - *Validation:* License format; expiration check.  
  - *Example:* `{"applicatorId": "A101", "name": "Joe Applicator", "licenseNumber": "MO-54321", "licenseType": "Commercial", "licenseExpiration": "2026-06-30"}`.  
  - *Editable:* Initially by contractor; after submission locked (manager may view but not change original).  
  - *Audit:* Included.

- **ApplicatorLicense** – Issued certification details (for some jurisdictions).  
  - *Fields:* `licenseId`, `applicatorId`, `state`, `type`, `categories`.  
  - *Type:* string, list.  
  - *Required:* `state`, `type`.  
  - *Validation:* See licenseType categories.  
  - *Example:* `{"licenseId": "L202", "applicatorId": "A101", "state": "MO", "type": "Commercial", "categories": ["7A", "7B"]}`.  
  - *Editable:* No (admin-managed).  
  - *Audit:* Yes (license details needed in export).

- **Field** – A specific field or area to be treated.  
  - *Purpose:* Represents geometry or location to link GPS and size.  
  - *Fields:* `fieldId`, `name`, `location` (GPS polygon/point), `area` (calculated), `propertyId`.  
  - *Type:* string, geo-coordinates, float.  
  - *Required:* `name`, `location`.  
  - *Validation:* Valid coordinates.  
  - *Example:* `{"fieldId": "F303", "name": "Field A", "location": [{"lat": 37.0, "lon": -89.5}, ...], "area": 50.2, "propertyId": "PROP1"}`.  
  - *Editable:* Yes (via map UI).  
  - *Audit:* Yes (used in report).

- **Property** – A farm or parcel (for organizational purposes).  
  - *Fields:* `propertyId`, `name`, `address` (legal description), `owner`.  
  - *Example:* `{"propertyId": "PROP1", "name": "North Farm", "address": "Sec 12-T25N-R5W", "owner": "Acme Farms"}`.  
  - *Audit:* Yes.

- **CropOrSite** – The crop, commodity, or site of the application (matches label site).  
  - *Fields:* `cropId`, `name`, `description`.  
  - *Required:* `name`.  
  - *Example:* `{"cropId": "CRP1", "name": "Corn", "description": "Field Corn"}`.  
  - *Audit:* Yes.

- **TargetPest** – Pest being targeted.  
  - *Fields:* `pestId`, `name`, `description`.  
  - *Example:* `{"pestId": "PST1", "name": "Western Corn Rootworm", "description": ""}`.  
  - *Audit:* Yes.

- **Product** – Pesticide product (brand).  
  - *Fields:* `productId`, `tradeName`, `epaRegNumber`, `manufacturer`, `labelId`.  
  - *Required:* `tradeName`, `epaRegNumber`.  
  - *Validation:* EPA# matches registered patterns (optional).  
  - *Example:* `{"productId": "P111", "tradeName": "SuperWeed KilleR", "epaRegNumber": "123-456", "manufacturer": "AgroCo", "labelId": "LBL111"}`.  
  - *Editable:* No (chosen from product catalog).  
  - *Audit:* Yes.

- **EPARegistration** – EPA registration details for a product.  
  - *Purpose:* Link product EPA# to info (restricted use, active ingredients).  
  - *Fields:* `epaRegNumber`, `activeIngredients`, `restrictedUse` (bool).  
  - *Example:* `{"epaRegNumber": "123-456", "activeIngredients": ["IngredientA"], "restrictedUse": true}`.  
  - *Editable:* No.  
  - *Audit:* Included via Product.

- **ProductLabel** – Link to or content of the pesticide label.  
  - *Fields:* `labelId`, `epaRegNumber`, `versionDate`, `pdfUrl`, `siteUses`.  
  - *Purpose:* Store key label metadata (approved uses, rates, REIs, etc.).  
  - *Example:* `{"labelId": "LBL111", "epaRegNumber": "123-456", "versionDate": "2023-07-01", "pdfUrl": "...", "siteUses": ["Corn", "Soybean"], "wdr": 30}`.  
  - *Editable:* No.  
  - *Audit:* Yes (source citation from label).

- **ApplicationJob** – A scheduled or planned application task.  
  - *Fields:* `jobId`, `contractorId`, `applicatorId`, `fieldId`, `cropId`, `targetPests` (list of `pestId`), `plannedDate`, `tankMix` (see below), `notes`.  
  - *Required:* `jobId`, `fieldId`, `plannedDate`.  
  - *Purpose:* Manager pre-assigns jobs to contractors.  
  - *Validation:* Planned date cannot be in past (or allow for retroactive entry?).  
  - *Example:* `{"jobId": "J900", "contractorId": "C789", "fieldId": "F303", "cropId": "CRP1", "targetPests": ["PST1"], "plannedDate": "2026-07-15", "notes": "Pre-emerge herbicide, watch precipitation"}`.  
  - *Editable:* Only before assignment/submission.  
  - *Audit:* No (supporting).

- **TankMix** – Details of products and rates in a mixture.  
  - *Fields:* `tankMixId`, `jobId` or `recordId`, list of `{productId, amount, unit}`.  
  - *Example:* `{"tankMixId": "TM455", "jobId": "J900", "mixtures": [{"productId": "P111", "amount": 2.5, "unit": "gal"}, {"productId": "P222", "amount": 5.0, "unit": "gal"}]}`.  
  - *Required:* Each mixture must have product and amount.  
  - *Audit:* Yes (amounts go to export).

- **ApplicationRecord** – The **immutable record** submitted by the contractor for each application.  
  - *Fields:* 
    - `recordId` (unique), 
    - `jobId` (if from a job), 
    - `contractorId`, `applicatorId` (making the entry), 
    - `fieldId`, `propertyId`, 
    - `cropId`, 
    - `targetPestIds`, 
    - `productMixture` (TankMix list), 
    - `applicationDate`, `startTime`, `endTime`, 
    - `areaTreated`, `areaUnits`, 
    - `weatherSnapshotId` (link), 
    - `gpsLocationId`, 
    - `notes`, 
    - `timestampCreated`.  
  - *Type:* Mixed (dates, floats, references).  
  - *Required:* All fields listed in R4 (Name, license of applicator; date/time; client; site; area; crop; pests; products; rates; weather).  
  - *Validation:* Fields (A–M) presence checked (e.g. `applicatorId`, `applicationDate`, `targetPestIds`, `productMixture`, `areaTreated`, etc.).  
  - *Example:* 
    ```json
    {
      "recordId": "R321",
      "jobId": "J900",
      "contractorId": "C789",
      "applicatorId": "A101",
      "fieldId": "F303",
      "propertyId": "PROP1",
      "cropId": "CRP1",
      "targetPestIds": ["PST1"],
      "productMixture": [
        {"productId": "P111", "amount": 2.5, "unit": "gal"}
      ],
      "applicationDate": "2026-07-15",
      "startTime": "08:30",
      "endTime": "09:10",
      "areaTreated": 50,
      "areaUnits": "acres",
      "weatherSnapshotId": "W789",
      "gpsLocationId": "G102",
      "notes": "",
      "timestampCreated": "2026-07-15T09:15:00Z"
    }
    ```  
  - *Editable:* **Immutable** after submission, except appended events (see section 4).  
  - *Audit:* All fields are included in the exported report.

- **GPSLocation** – GPS data at record time.  
  - *Fields:* `gpsLocationId`, `latitude`, `longitude`, `timestamp`.  
  - *Required:* Yes (with record).  
  - *Validation:* coords within field bounds ideally.  
  - *Audit:* Yes.

- **WeatherSnapshot** – Weather at time of application.  
  - *Fields:* `weatherSnapshotId`, `windSpeed`, `windDirection`, `airTemperature`, `humidity`, `timestamp`, `source`.  
  - *Required:* Wind direction/speed, temp are **legally required** for outdoor use【7†L146-L149】.  
  - *Validation:* Usually auto-captured or manually entered; if missing, alert.  
  - *Example:* `{"weatherSnapshotId": "W789", "windSpeed": 5.2, "windDirection": 270, "airTemperature": 80, "humidity": 50, "timestamp": "2026-07-15T08:45:00Z", "source": "auto-fetch"}`.  
  - *Editable:* No (immutable, though can append new snapshot if updated).  
  - *Audit:* Yes.

- **ComplianceCheck** – Result of running a rule/check on an application.  
  - *Fields:* `checkId`, `recordId`, `ruleId`, `status` (pass/warn/fail), `message`, `timestamp`.  
  - *Example:* `{"checkId": "CHK1001", "recordId": "R321", "ruleId": "REQ_FIE_MISSING", "status": "warning", "message": "Target pest missing", "timestamp": "2026-07-15T09:16:00Z"}`.  
  - *Editable:* No (automated log).  
  - *Audit:* Show warnings in review export.

- **ComplianceWarning** – A specific flagged issue.  
  - *Fields:* `warningId`, `recordId`, `ruleId`, `description`, `severity` (e.g. warning vs block).  
  - *Editable:* See rules (once created by engine, can be dismissed or annotated by reviewer).  
  - *Audit:* Yes (list of warnings included).

- **CorrectionRequest** – Manager’s request for contractor to fix a record.  
  - *Fields:* `correctionId`, `recordId`, `managerId`, `message`, `timestamp`.  
  - *Example:* `{"correctionId": "C654", "recordId": "R321", "managerId": "U456", "message": "Please provide wind speed", "timestamp": "2026-07-15T10:00:00Z"}`.  
  - *Editable:* No (log only).  
  - *Audit:* Included.

- **ManagerReview** – Manager’s review outcome.  
  - *Fields:* `reviewId`, `recordId`, `managerId`, `decision` (approved/rejected), `notes`, `timestamp`.  
  - *Example:* `{"reviewId": "M888", "recordId": "R321", "managerId": "U456", "decision": "approved", "notes": "All good", "timestamp": "2026-07-16T08:00:00Z"}`.  
  - *Audit:* Yes.

- **AuditPacket** – A compiled export for one or more records (for audit/report).  
  - *Fields:* `packetId`, `createdTimestamp`, `recordsIncluded` (list of `recordId`), `pdfUrl`, `citations`.  
  - *Example:* `{"packetId": "PAP001", "createdTimestamp": "2026-07-16T08:05:00Z", "recordsIncluded": ["R321","R322"], "pdfUrl": "/exports/packet_PAP001.pdf", "citations": ["2 CSR 70-25.120","40 CFR 171"]}`.  
  - *Audit:* Export itself is output.

- **Export** – Individual export files (PDF or CSV).  
  - *Fields:* `exportId`, `type` (PDF/CSV), `packetId`, `generatedTimestamp`, `filePath`.  

- **SourceCitation** – Links regulatory sources or label references used in compliance logic.  
  - *Fields:* `citationId`, `sourceName`, `jurisdiction`, `url`, `documentTitle`.  
  - *Purpose:* Track which law/regulation was used (e.g. “2 CSR 70-25.120” with link) when flagging issues.  
  - *Audit:* Yes (citation list in packet).

### Relationships

- **Organization** 1–* **Contractor/User**: Contractors and Users belong to an organization.  
- **Organization** 1–* **Property**: A farm (property) belongs to an organization.  
- **Property** 1–* **Field**: Fields are parts of a property.  
- **Job** 1–* **ApplicationRecord**: A job can produce one or more application records (if split/done multiple days).  
- **Contractor** 1–* **ApplicationJob**: A contractor is assigned jobs.  
- **Applicator** *–* **ApplicationRecord**: The applicator field links to an applicator record (many apps by one person).  
- **ApplicationRecord** 1–* **TankMix**/**ComplianceCheck**/**CorrectionRequest**/**ManagerReview**: Each application record can have multiple mixes, checks, warnings, etc.  
- **Record** *–1* **WeatherSnapshot**, **GPSLocation**: Each record may reference one snapshot or a chain of appended snapshots.  
- **AuditPacket** 1–* **ApplicationRecord** (via `recordsIncluded`).

The data model embeds legal requirements as fields (e.g. Applicator license info, weather). Editable status: *once an ApplicationRecord is submitted*, its core fields (applicator, date/time, products, area, pests, weather) are **immutable**. Subsequent manager actions (warnings, corrections, approval) only append to the event log.

## 4. Record Immutability Model

FieldLog treats each submitted **ApplicationRecord** as an immutable evidence document. The original contractor submission can **only be appended**, not overwritten. Manager/inspector inputs create new append-only events. Key principles:

- **Immutable content:** After a record is *submitted*, fields (applicator, products, timings, area, weather, etc.) cannot be edited. This preserves chain-of-custody.  
- **Appends allowed:** Managers can add data via _CorrectionRequest_ or _ManagerReview_, which are logged as new entries linked to the record.  
- **Corrections workflow:** If a manager requests a correction, the contractor resubmits a *new* ApplicationRecord (with a new recordId) linked to the original `jobId`. The original remains in the log as “submitted but corrected.”  
- **Chaining and versioning:** Each event (JOB_CREATED, RECORD_DRAFTED, etc.) is timestamped and linked. The log distinguishes the *original contractor record* vs. any *corrected record*.  
- **Hashing for audit:** Each event log entry can be hashed (e.g. SHA-256 of JSON) and the hash stored, to detect tampering (not a full blockchain, just verify integrity). E.g. store `eventHash = hash(timestamp+type+payload)`.  
- **Audit timeline:** The system can export an event timeline: for each record, list events (job assignment, submission, checks, warnings, manager actions, approval, export). This timeline is part of the audit packet.  

### Append-only Event Model

FieldLog generates and logs events in sequence. Example events:

- `JOB_CREATED` – A manager creates a new application job (backend event).  
- `JOB_ASSIGNED` – Job is assigned to a contractor.  
- `RECORD_DRAFTED` – Contractor creates a draft record (offline).  
- `RECORD_SUBMITTED` – Contractor submits the record (final).  
- `RECORD_SYNCED` – Record is synced from offline to server.  
- `WEATHER_ATTACHED` – Weather data (snapshot) is attached to the record.  
- `COMPLIANCE_CHECK_RUN` – System runs checks on the record.  
- `WARNING_CREATED` – System flags a missing field or inconsistency.  
- `MANAGER_REVIEWED` – Manager marks record Approved or Rejected.  
- `CORRECTION_REQUESTED` – Manager requests contractor to correct a field.  
- `CONTRACTOR_CORRECTED` – Contractor submits corrected record (new recordId).  
- `RECORD_APPROVED` – Manager approves record (final).  
- `AUDIT_PACKET_EXPORTED` – System exports the record(s) to PDF for audit.

Each event: `{eventId, type, timestamp, userId, details}` is stored, hashed, and non-editable. The audit export includes the event log and source citations for rules applied.

## 5. Product Requirements Document

**Vision:** FieldLog is a **mobile-first PWA** that helps multi-site farming operations and their contractors log pesticide sprays in compliance with Missouri/federal requirements. It **captures**, **validates**, and **organizes** application data on the spot, flags issues, and produces audit-ready reports – letting managers trust the records without guaranteeing legal compliance.  

**Target Customer:** Mid-to-large agricultural operations (e.g. farms, nurseries) using multiple spray contractors.  

**User Personas:**  
- *Operations Manager:* Needs oversight of contractors’ pesticide use to meet regulations. Wants easy summary, audits, and peace of mind.  
- *Spray Contractor/Applicator:* Needs a quick way to log each spray job (often offline in field). Appreciates guidance on required fields and feedback on missing info.  
- *Compliance Officer:* Values clear traceability, source citations, and legal defensibility. (Often the same as manager.)  

**Pain Points:** Disorganized records (paper/spreadsheets/notes), uncertainty about completeness, liability for missing data, difficulty proving compliance in audits, lack of real-time verification.  

**Jobs to be Done:**  
- As a manager, I want to **create and assign spray jobs**, so contractors know what to do.  
- As a contractor, I want to **log each pesticide use** easily (even offline), so the manager can see what I did.  
- As a manager, I want to **review and approve** submitted logs, so that records are audit-ready.  
- As a system, I want to **enforce required fields**, so logs meet basic legal standards before approval.  
- As a manager, I want to **generate audit reports/PDFs** showing full details, so I can submit to regulators.  

**MVP Scope (Ruthless):**  
- Core screens: Manager Dashboard, Job Creation, Contractor Record Form (offline), Record Detail/Review, Audit PDF export.  
- Data capture: All fields from R4 (A–M) with validation. (Required: applicator, date/time, site, crop, pest, product+EPA#, amount, rate, area, weather).  
- Validation rules: Mark missing fields; flag RUP usage.  
- GPS and weather: Attempt to auto-fill via device API or mock data if offline.  
- Immutable timeline: Display events for each record.  
- Export: Export selected records as a single PDF with audit packet.  
- Simulated data or connectors: If no real weather/GPS, use placeholders but clearly label as simulation (e.g. “WIND: 5 mph (simulated)”).  
- Security: Simple login (email+password).  
- Demo dataset: Pre-populated org, fields, products.

**Non-Goals:**  
- *Do not* attempt to *guarantee* legal compliance or offer legal advice.  
- *Do not* cover pesticide purchasing/inventory. Dealers minimal support.  
- *Do not* require continuous connectivity; offline sync only needed for submissions.  
- *Avoid:* Complex features like real-time mapping, third-party integrations (except simple weather API), AI beyond basic.  
- *Avoid:* Multi-state compliance beyond Missouri for MVP (stick to Missouri law).  

**Core Workflows:**  
1. **Manager creates job:** Enters field, crop, target pest, date. Assigns to contractor.  
2. **Contractor logs application:** Fills form (auto-filled job context), picks product (from EPA list), enters quantity, rate, time, weather (auto/GPS if available).  
3. **System checks compliance:** Validates required fields, cross-checks label compatibility (if label in DB), flags issues.  
4. **Manager reviews record:** Sees entries and warnings, can request corrections or approve.  
5. **Export report:** Manager exports records to PDF audit packet (with events, warnings, citations).  

**User Stories & Acceptance Criteria (Examples):**  
- *Story:* As a contractor, I want to record a spray job offline so I don’t lose data.  
  - *AC:* I can create a record in offline mode; it stores locally and syncs when online. A “synced” event is logged. If offline, the app clearly indicates unsynced status.  
- *Story:* As a manager, I want missing fields flagged so I know what to follow up on.  
  - *AC:* If any legally required field (e.g. weather) is blank, the record shows a warning icon and text e.g. “Missing wind speed (required)”.  
- *Story:* As a manager, I want to export all application logs in PDF so I can hand them to inspectors.  
  - *AC:* Clicking “Export” generates a PDF with cover, organization info, record details, weather, events timeline, and cites relevant laws/regulations without stating compliance.  

**Edge Cases:**  
- Missing or invalid GPS: allow manual override or “location not captured” flag.  
- Weather API fails: allow manual entry or skip with warning.  
- Product not in database: allow entry but mark “Product not verified”.  
- Corrections: Contractor edits only after manager request, system links new record to job.  
- Simulate offline: Test record creation while disconnected.

**Risk Controls:** (to be expanded in risk register) e.g. disable “force approve” if warnings exist; audit log cannot be edited; disclaimers everywhere.  

**Success Metrics:** (for demo/hack) number of records logged without errors, % records passing all required checks, time to log one record, PDF generation time. For business: user acquisition (farm sign-ups) after hackathon, feedback from pilot customers.

**Demo Constraints:** Show only functioning features. Make clear which parts are simulated (e.g. weather). Emphasize immutability and source citations in PDF.

**Post-Hackathon Roadmap:** (see section 16) focus on technical debt, state expansions, integration with label database, add limited AI helpers (guided by citations).

## 6. MVP Feature Prioritization

Features are classified by priority:

- **Must-have (Demo + Core MVP):** Manager dashboard; job creation/assignment; contractor spray-log form; offline support/sync; capture all required fields (A–M); field validations (e.g. non-empty, numeric checks); weather data (via API or placeholder); GPS (device or default); immutable record with timeline; compliance checklist with source links; manager review (approve/reject/correct); PDF audit export; demo data pre-loaded.  
- **Should-have (if time permits):** Bulk import products from EPA PPLS; auto-lookup product by name/EPA; auto-calc area if GPS polygon known; simple search/filter in dashboard; email notifications for correction requests.  
- **Stretch:** Two-way label integration (show active ingredient efficacy or off-label warnings), localized language, multi-state profiles.  
- **Cut:** Integration with dealer systems or real marketplace prices; blockchain or advanced encryption beyond basic hashing; full agronomic advice.  
- **Simulated:** Real weather/GPS when offline. For the demo, if offline or missing API key, show dummy values with note.  
- **Must Actually Work:** All *must-have* features. Do not just fakes: form validation, offline storage/sync, PDF generation, event log. Simulation only allowed for external data like weather.

Be ruthless: Any feature risking incorrect legal claims (e.g. “compliant”) is removed or rephrased as “likely complete” with citations. Avoid anything beyond one strong demo path.

## 7. Compliance Rules Engine Design

FieldLog includes a lightweight rules engine that checks records against known requirements **without asserting “compliance”**. Each rule has: a condition, a source citation, and a status (e.g. OK, Missing, Warning, Blocked). Rules should not produce a flat “Compliant/Noncompliant” but flag issues needing review.

**Rule Types:**  
- **Required Field Check:** Verify required fields from R4 are present (e.g. targetPest, wind). If missing, status “Missing required field”.  
- **RUP Flag:** If product is marked Restricted Use (EPA data) and applicator uncertified for RUP, flag “Blocked by license requirement”.  
- **Timing Check:** Compare `applicationDate` to `recordCreated`; if >3 days gap, warning “Record completed late (violates 2 CSR 70‑25.120)”.  
- **Label Use Check:** If app includes a crop/pest/product not on the cached label siteUses, status “Label usage mismatch (review)”.  
- **Weather Check:** If `windSpeed` or `windDirection` missing in outdoor use, warn “Weather not recorded – required per regs.”  
- **One-per-day check:** (optional) If two records by same applicator same product/date on same field, warn duplicate.  
- **Inactive Product:** If `epaRegNumber` not found, warn “Product not recognized.”

**Each rule entry example (JSON-like):**

```json
{
  "ruleId": "REQ_FIELD_TARGET",
  "description": "Target pest(s) must be recorded (2 CSR 70-25.120(H))",
  "type": "required_field",
  "field": "targetPestIds",
  "jurisdiction": "MO",
  "severity": "error",
  "statusMessage": "Missing target pest (required by Missouri regulation【7†L124-L131】)"
}
```

```json
{
  "ruleId": "REQ_FIELD_WIND",
  "description": "Wind speed and direction required for outdoor application (2 CSR 70-25.120(M))",
  "type": "required_field",
  "fields": ["windSpeed","windDirection"],
  "jurisdiction": "MO",
  "severity": "warning",
  "statusMessage": "Outdoor weather not fully recorded (temp, wind)【7†L146-L151】"
}
```

```json
{
  "ruleId": "CHECK_RUP_LICENSE",
  "description": "Restricted use product requires certified applicator (RSMo 281.048, 2 CSR 70-25.120)",
  "type": "conditional",
  "condition": "product.isRestricted && !applicator.hasRUPLicense",
  "jurisdiction": "MO",
  "severity": "blocked",
  "statusMessage": "Restricted pesticide used by uncertified applicator (illegal under Missouri law【41†L136-L143】【39†L137-L144】)"
}
```

```json
{
  "ruleId": "CHECK_RECORD_AGE",
  "description": "Record must be completed within 3 business days (2 CSR 70-25.120(1))",
  "type": "timing",
  "condition": "daysBetween(applicationDate, recordCreated) > 3",
  "jurisdiction": "MO",
  "severity": "warning",
  "statusMessage": "Record submitted more than 3 business days after application【7†L87-L95】"
}
```

Rules output statuses such as “Complete”, “Missing field”, “Needs review”, or “Blocked”. Each flagged issue is recorded as a **ComplianceWarning** with a source. No rule should output “Compliant”; only absence of warnings means “complete record”. All rule messages include citations (as above) to ground them.

## 8. AI Feature Design

**Good AI Use Cases:**  
- **Audit Summary:** *Input:* Audit packet data; *Output:* Plain-English summary of findings (no legal advice). *Guardrails:* Must cite sources if making claims; for missing fields/warnings, only rephrase from system. *Human review:* Required before using in official docs. *Failure:* Too generic or false suggestions.  
- **Explain Missing Info:** *Input:* Record fields + warnings; *Output:* Suggest why fields are missing and likely solution (“Missing wind speed – suggest capturing from phone sensors”). *Guardrails:* No legal advice, no invented regs; cite applicable rule if referenced.  
- **Draft Correction Request:** *Input:* One or more warnings, record details; *Output:* A concise message to contractor (e.g. “Please specify wind speed and direction for 7/15/2026 spray (required by MO regs)”). *Guardrails:* Tone helpful, not scolding; cite specific reg name/number (e.g. “2 CSR 70-25.120(M)”); human edits always.  
- **Label Field Extraction:** *Input:* Photo or PDF of product label; *Output:* Extract candidates (product name, EPA #, crop uses, pests). *Guardrails:* Present as suggestions; user must verify. Only handle text extraction; if OCR fails, user retries. *Failure:* Misread data (misreading EPA #). Show low confidence flag.  
- **Law-to-Rules Translation:** *Input:* Excerpts of regulatory text; *Output:* Structured rule parameters (fields, units, timing). *Guardrails:* Only under expert/admin mode with citations; all AI-suggested rules must be validated by human. *Failure:* Misinterpreting ambiguous text; always mark uncertainty.  
- **Demo Narration:** *Input:* System state (jobs created, record submitted, flagged issues); *Output:* Narrative for demo scenarios. *Guardrails:* Confirm with script; not for final UI. *Failure:* Minor if off-script, since it's only for judges.

**Bad AI Use Cases:**  
- **Legal decisions:** Do not let AI label a log “compliant”. Always use caution language.  
- **Inventing rules:** AI must not create new requirements not in code. E.g. cannot conjure an EPA rule. All rules must have citations.  
- **Label analysis:** AI should not recommend off-label usage or ignore label restrictions. Only flag.  
- **Agronomic advice:** E.g. “should use more pesticide” – not allowed.

For each AI component, we plan input, output, guardrails, etc. E.g.:

- *Summarize Audit Packet:*  
  - **Input:** AuditPacket data including records, warnings, review status.  
  - **Output:** A one-page summary “This audit packet contains X records from Jan–Mar 2026. All records have required fields except [list issues]. Source citations included.”  
  - **Guardrails:** Use only provided packet data; no external info.  
  - **Human Review:** Must check for hallucinations (e.g. invented citations).  
  - **Failure:** If AI misrepresents a field as missing, human should catch it.  

- *Draft Correction:*  
  - **Input:** ComplianceWarning (e.g. missing field) plus context (record details).  
  - **Output:** Friendly request message to contractor.  
  - **Guardrails:** Include rule citation, e.g. “As per Missouri Reg 2 CSR 70-25.120, please add target pest”【7†L124-L131】.  
  - **Human Review:** Manager edits before sending.  
  - **Failure:** If AI suggests something not in rules, it must revert to a generic ask.

Each AI use must tag citations if making normative claims (e.g., referencing a rule). Use consistent format. AI outputs are shown in UI or internal only (e.g. not auto-post to field).

## 9. Evaluation and Test Harness

To prove this is a data/AI solution (not a mere wrapper), we define tests and metrics:

**Synthetic Dataset:** Generate ~20 sample application records with variations (including no missing, some missing fields, weather gaps, product issues, corrections).  

**Test Cases (20 examples):**  
- *8 Clean records:* All fields filled legally (various pesticides, fields, times) – expect all checks pass (Complete record).  
- *5 Missing fields:* Remove one required field each (e.g. missing wind, missing applicator, missing area, missing product, missing pest) – expect “Missing field” warnings.  
- *3 Weather/GPS problems:* e.g. GPS off-field; wind speed <0 or >100; expect “location suspect” or “weather out-of-range” warnings.  
- *2 Product/label ambiguity:* e.g. crop not on label, or unknown EPA#: expect “Label mismatch” or “Unknown product” warnings.  
- *2 Correction workflow:* E.g. manager rejects due to missing pest, contractor resubmits corrected record – test linking and timeline.  

**Automated Tests:**  
- **Required-field detection accuracy:** For each record, detect all missing fields; measure precision/recall. Aim >95%.  
- **False positive/negative rates:** Particularly for warnings (low false negatives crucial – missing a violation is bad).  
- **Citation Coverage:** Each rule check that triggers should have a citation in message. Aim >99% of flags citing a source.  
- **Offline Sync Success:** Simulate offline creation and delayed sync; test if record appears correctly when reconnected.  
- **Audit Packet Completeness:** Verify that exported PDF contains all required sections (cover, records, timeline, citations).  
- **UI Responsiveness:** For 3-minute demo speed; keep actions <2s.  

**Metrics:**  
- *Time to log application:* target <2 min with form assistance.  
- *Requirement check accuracy:* target >95%.  
- *False issue rate:* <5% of logs incorrectly flagged.  
- *Export generation time:* <5s for <20 records.  

## 10. Technical Architecture

A pragmatic architecture for hackathon MVP (scalable for future):

- **Frontend (PWA):** React or Next.js app.  
  - *Responsibility:* UI for manager and contractor; form handling; local store.  
  - *Interfaces:* API calls to backend; IndexedDB for offline caching (records, jobs, reference data).  
  - *Failure Modes:* JS errors; offline sync conflicts.  
  - *Hackathon Shortcuts:* Use a UI component library (e.g. Material UI) for speed. Skip fancy styling.  
  - *Production Version:* Add native packaging (React Native or wrapping), more polished UI/UX.

- **Offline Store:** IndexedDB in browser/PWA.  
  - *Ownership:* Client.  
  - *Usage:* Store drafts and reference lists (fields, products, citations).  
  - *Failure:* Storage full, IDB errors.  
  - *Shortcut:* Use a simple wrapper library (Dexie.js).  
  - *Pro Upgrade:* CRDT or conflict-free sync, mobile app with SQLite offline.

- **Backend API:** Node.js with Express (or Next.js API routes).  
  - *Responsibility:* Authentication, data endpoints (jobs, records, reviews, exports), business logic, rules engine.  
  - *Interfaces:* REST or GraphQL.  
  - *Failure Modes:* Downtime, errors, security vulnerabilities.  
  - *Hackathon:* Minimal auth (JWT with hardcoded user, skip OAuth).  
  - *Production:* Use a framework (Nest.js or Express with TypeScript), robust auth (OAuth, multi-tenant).

- **Database:** PostgreSQL (demo SQLite possible).  
  - *Data:* All entities above.  
  - *Failure:* DB down (fallback to memory? unlikely needed); data corruption (use migrations).  
  - *Shortcut:* Use SQLite or Postgres via a hosted service if time.  
  - *Production:* Proper Postgres on cloud, with backups. Possibly multi-tenant support later.

- **Auth:** Simple (email/password) for demo.  
  - *Production:* Scalable user management (Auth0 or Keycloak) for roles and multi-org isolation.

- **PDF Generation:** 
  - *Choices:* Library like Puppeteer (print to PDF) or server-side (Node libraries).  
  - *Responsibility:* Create audit packet PDF.  
  - *Failure:* PDF formatting errors.  
  - *Hackathon:* Use an HTML template + wkhtmltopdf or Puppeteer.  
  - *Production:* Possibly microservice (DocRaptor, etc).

- **Weather API Adapter:** 
  - *Function:* Fetch current or historical weather (wind, temp) for a location/time.  
  - *Shortcut:* Use a free API (OpenWeatherMap) or mock data.  
  - *Failure:* Rate limits (have static fallback).  
  - *Production:* Use premium API (e.g. NOAA or Weather Company data) or fallback to user entry.

- **Rules Engine:** 
  - *Type:* Lightweight JSON-driven.  
  - *Responsibility:* Validate records post-submit, generate warnings.  
  - *Implementation:* Could be simple code in Node (evaluate JSON rules) or a small rule engine (json-rules-engine).  
  - *Failure:* Incorrect rule application (unit tests mitigate).  
  - *Production:* Possibly AI-assist to update rules, more rules integrated.

- **Event Log:** 
  - *Responsibility:* Record state changes.  
  - *Implementation:* Table `events(eventId, recordId, type, payload, timestamp, hash)`.  
  - *Failure:* Sync issues; ensure ordering.  
  - *Shortcut:* Just append to DB on each action.  
  - *Production:* Possibly Kafka or append-only log with CQRS.

- **AI Service Layer:**  
  - *Responsibility:* Host AI functions (summarize, explain, draft).  
  - *Interfaces:* Call OpenAI or local model for tasks.  
  - *Failure:* API costs/availability.  
  - *Shortcut:* Hardcode canned responses for demo.  
  - *Production:* Use a managed LLM (Azure/OpenAI) with chain-of-thought disabled, enforce citations.

- **Source Citation Database:**  
  - *Purpose:* Store the text or metadata of rules.  
  - *Fields:* We can embed citation info as part of rule definitions (id, text snippet, URL).  
  - *Responsibility:* Provide text for export and rule lookup.  

Each component is minimal for demo with clear path to production upgrade.

## 11. API Design

Key REST API endpoints (JSON payloads):

- **POST /api/organizations** – Create organization  
  - *Body:* `{name, address, contactInfo}`.  
  - *Response:* `{orgId,...}` or error (401).  

- **POST /api/contractors** – Create contractor  
  - *Body:* `{name, licenseNumber, expiration, certCategories}`.  
  - *Validation:* Require valid license format, future expiration.  
  - *Response:* `{contractorId,...}`.

- **POST /api/fields** – Create field  
  - *Body:* `{name, locationCoords[], propertyId}`.  
  - *Validation:* Nonempty name, valid geo.  
  - *Response:* `{fieldId,...}`.

- **POST /api/jobs** – Create application job  
  - *Body:* `{fieldId, cropId, targetPestIds[], plannedDate, contractorId}`.  
  - *Response:* `{jobId,...}`.

- **POST /api/records/draft** – Save offline draft  
  - *Body:* `{jobId, contractorId, data: {all record fields}}`.  
  - *Response:* `{draftId}` (no major processing).

- **POST /api/records/submit** – Sync submitted record  
  - *Body:* `{jobId?, contractorId, applicatorId, applicationDate, startTime, endTime, fieldId, cropId, targetPestIds, tankMix, areaTreated, areaUnits, weather: {windSpeed, windDir, temp}, gps: {lat, lon, timestamp}}`.  
  - *Validation:* Check required fields.  
  - *Response:* `{recordId}` or list of warnings.

- **POST /api/records/:id/compliance-check** – Run checks (auto-run on submit)  
  - *Body:* none.  
  - *Response:* `{warnings: [ ... ]}` (populated after submit).

- **POST /api/records/:id/attach-weather** – Attach weather snapshot  
  - *Body:* `{windSpeed, windDir, temp, humidity}`.  
  - *Response:* `{weatherSnapshotId}`.

- **POST /api/records/:id/request-correction** – Manager requests fix  
  - *Body:* `{managerId, message}`.  
  - *Response:* `{correctionId}`.

- **POST /api/records/:id/approve** – Manager approves record  
  - *Body:* `{managerId, decision: "approved"|"rejected", notes?}`.  
  - *Response:* `{reviewId}`.

- **GET /api/export/audit** – Generate audit packet  
  - *Query:* `?recordIds[]=R1&recordIds[]=R2&...`  
  - *Response:* `{packetId, pdfUrl}`.

- **GET /api/lookup/products?name=WeedKiller** – Product lookup (optional)  
  - *Body:* none.  
  - *Response:* list of products matching name/EPA.

For each endpoint, return appropriate errors (400 on validation, 401 if unauthorized, 500 on server error). All requests/headers carry an auth token (skipped demo).

## 12. UI/UX Blueprint

Key screens for mobile-first PWA:

- **Landing/Demo Home**  
  - *User:* Manager (demo).  
  - *Purpose:* Overview of organization and demo scenario intro.  
  - *Fields:* Intro text, “Login” button (or skip to dashboard).  
  - *Primary Action:* Go to Dashboard.  
  - *Failure:* If no org data, show default “Demo Org”.  
  - *Demo Talk:* “This is FieldLog – your app to capture pesticide applications on the spot.”

- **Manager Dashboard**  
  - *User:* Manager.  
  - *Purpose:* Summarize jobs and records.  
  - *Fields:* Summary stats (pending jobs, pending logs, warnings). List of jobs and submitted records with status.  
  - *Primary Action:* “Create Job” button. Clicking a record goes to detail.  
  - *Secondary:* Filter (by date, status), “Export PDF” action if any records present.  
  - *Failure:* Show “No records yet” state with prompt to add.  
  - *Demo Point:* Show one job pending, one completed record with a warning icon.

- **Job Creation Screen**  
  - *User:* Manager.  
  - *Purpose:* Create/assign new spray job.  
  - *Fields:* Field (dropdown or map), Crop (dropdown), Target pests (multi-select), Date, Contractor (dropdown), Notes.  
  - *Action:* Save job.  
  - *Validation:* All required picks done.  
  - *Failure:* Validation errors highlighted (e.g. missing date).  
  - *Demo:* Quick create for “Field A, Corn, Pest X, July 15, assign to GoodSpray”.

- **Contractor Application Logging Screen (Mobile)**  
  - *User:* Contractor.  
  - *Purpose:* Enter actual spray data.  
  - *Fields (required):*  
    - Applicator Name/License (pre-filled if logged in),  
    - Job/Field (pre-selected from assignment, or manual selection if walking in),  
    - Date (default to today, editable), Start/End time (default to now),  
    - Crop (from job or manual), Target pest(s),  
    - Product (trade name or select; fetch EPA#), Tank mix details (product, amount, unit),  
    - Area treated (value + unit), GPS button (capture location, fallback text if denied),  
    - Weather (auto-fetch: temp, wind; manual override fields visible).  
  - *Primary Action:* “Submit Record”.  
  - *Secondary:* “Save Draft”.  
  - *Failure States:* If offline, show banner “Offline – Save to sync later.” After submit, show “Record submitted successfully.”  
  - *Demo:* Walk through logging a record: pick product, auto-fill weather, hit Submit, see success message.

- **Offline Status Indicator**  
  - *User:* Contractor.  
  - *Purpose:* Show current connectivity.  
  - *Indicator:* A banner or icon (green “online” or red “offline”).  
  - *Action:* None.  
  - *Demo:* Toggle offline on device; show the app still works.

- **Record Detail Page (Manager view)**  
  - *User:* Manager.  
  - *Purpose:* Review a submitted record.  
  - *Fields:* Show all captured fields (applicator, times, products, amount, area, weather, GPS, pictures if any).  
  - *Panels:* Compliance Checklist panel listing each required field with status (✓ or “Missing”), Warnings list.  
  - *Primary Action:* “Approve” or “Request Correction”.  
  - *Secondary:* “Edit (manager note)” to add annotation (does not change original fields, only appends note).  
  - *Failure:* If record missing required field, highlight in red; cannot press Approve until resolved (could allow with warning).  
  - *Demo:* Show one record with missing wind speed flagged (☒ Weather), user clicks “Request Correction”.

- **Missing Fields / Warnings Panel**  
  - *User:* Manager (and visible in contractor form as hints).  
  - *Purpose:* Highlight exactly what is missing or out-of-range.  
  - *Content:* List (“Missing target pest”, “Weather not recorded”) with icons and link to field.  
  - *Demo:* Shows a red warning bullet by “Target Pest” with text from rule.

- **Event Timeline (Record Page)**  
  - *User:* Manager.  
  - *Purpose:* Show chronological log (Job assigned, record submitted, checks, correction requested, approved).  
  - *Display:* “2026-07-15 08:30 – Contractor Joe started record. 09:15 – Weather attached. 09:16 – CheckRun: Missing wind speed. 10:00 – Manager requested correction. 2026-07-16 08:00 – Manager approved.”  
  - *Demo:* Emphasize transparency, chain-of-custody.

- **Correction Request Screen**  
  - *User:* Contractor receives this.  
  - *Purpose:* View manager’s requested changes.  
  - *Fields:* List of fields to fix and manager message.  
  - *Action:* “Edit Record” to update only those fields.  
  - *Demo:* After “Request Correction”, contractor sees message and updates record to include missing data.

- **Audit Packet Preview**  
  - *User:* Manager.  
  - *Purpose:* Quick view of PDF content.  
  - *Fields:* Show first page summary.  
  - *Primary Action:* “Download PDF”.  
  - *Demo:* Show before export; emphasize content summary.

- **PDF Export**  
  - *Content:* See section 13. (Data not on UI)

Throughout, UI should display **source citations** (short form) on any regulatory mention. E.g. in “Weather required” note, include “[2 CSR 70-25.120]”. This grounds the rules without giving legal advice.

## 13. Audit Packet Specification

The audit packet is a consolidated PDF of application records and context. It should include:

- **Cover Page:** Org name, report title (“FieldLog Audit Packet”), date range, disclaimers.  
- **Organization Info:** Name, address, license info of organization.  
- **Applicator/Contractor:** Names and license numbers of contractors/applicators for each record.  
- **For each Application Record:**  
  - Product trade name and EPA reg #, EPA label citation (source of product data).  
  - Crop/site, field/property, treated area, date, start/end time.  
  - Amount applied (with unit) and rate (with unit).  
  - Target pest(s).  
  - Weather: wind speed/direction/temperature.  
  - GPS coordinates (lat/lon).  
  - Manager review status (approved/correction) and any notes.  
  - Warnings/Corrections listed with references (e.g. “Missing field: Wind speed (2 CSR 70‑25.120(M))”).  
- **Event Timeline:** For each record (as described in UI blueprint).  
- **Source Citations:** List of legal sources (e.g. “Missouri RSMo 281.035; 2 CSR 70-25.120; 40 CFR 171…”).  
- **Disclaimer:** Statement like “This packet is generated by FieldLog. The app provides source-linked information but does not itself guarantee regulatory compliance.” (Respect note to not claim compliance guarantee.)  

**Sample Outline (for one record):**  

1. **Cover:** FieldLog Audit Packet – Acme Farms (Jan–Mar 2026)【7†L87-L95】【41†L136-L143】.  
2. **Applicator:** John Doe (Lic. MO-12345) – *Certified Commercial Applicator*.  
3. **Job:** Field A (North Farm, 50.2 ac), Target: Western Corn Rootworm.  
4. **Product:** SuperWeed KilleR (EPA Reg 123-456) – 2.5 gal. at 1.0 gal/ac.  
5. **Date/Time:** 2026-03-15, 08:30–09:15.  
6. **Weather:** 70°F, Wind 5 mph SSW (retrieved from API).  
7. **Compliance:** 3-day record (within 3 days)【7†L87-L95】, RUP used by certified applicator, all fields present.  
8. **Timeline:**  
   - 03/15 08:30: Record drafted (Joe Doe).  
   - 03/15 09:16: Weather attached.  
   - 03/15 09:17: CheckRun – **Warning**: Missing wind direction (RUP requires【7†L146-L149】).  
   - 03/15 10:00: Manager correction requested.  
   - 03/15 11:00: Contractor updated wind (5 mph, 190°).  
   - 03/15 11:05: Manager approved.  
9. **Source Citations:** [RSMo 281.035; 2 CSR 70-25.120(A)-(M); USDA AMS RUP guidelines].  
10. **Disclaimer:** FieldLog automates recordkeeping capture; final compliance judgment by human.

## 14. Hackathon Demo Plan

**Demo Story:** Show seamless manager–contractor workflow. Manager sets up a job; contractor logs it offline; system flags one missing item; manager requests fix; contractor corrects; manager approves; export.

- **30-second intro:** “FieldLog lets managers of farms see exactly what their spray crews did. In this demo, a manager will create a spray job, a contractor will log the pesticide use in the field (even offline), and FieldLog will verify required data, flag a missing item, let the manager request a fix, then export an audit-ready report that cites Missouri law (without claiming compliance).”  

- **3-minute script:**  
  1. *Manager Dashboard:* “I’m the farm manager. I see pending jobs and reports. I’ll create a new spray job for [Field A] targeting [Pest X] next week, assign it to [GoodSpray Inc].” (Click “Create Job”, fill in fields, save.)  
  2. *Contractor App (mobile view):* “Now switching to the contractor’s phone: They receive the job. They open FieldLog, select the job, and start logging. The app auto-fills the date and uses GPS to identify the field location. They enter start/end times, choose the product and amount, the target pest, and press “Record Weather.” (Show weather auto-filled.) All required fields (applicator name, EPA # from product, etc.) are filled. They hit Submit (offline sync simulated).”  
  3. *Validation:* “FieldLog runs its checks and shows a warning: wind speed recorded but **wind direction missing** – required by regulation【7†L146-L149】. The contractor ignored direction. The manager sees this on the dashboard: one record has a warning icon.  
  4. *Correction:* Manager clicks the record, sees the warning panel. He clicks “Request Correction”, types “Please provide wind direction (required)”.  
  5. *Contractor Fix:* The contractor reopens the app (offline still). The correction request appears. The contractor adds “190° S” into wind direction, then resubmits.  
  6. *Manager Approval:* Manager sees the updated record – now all fields complete. He clicks “Approve”.  
  7. *Export:* Manager clicks “Export Audit PDF”. The generated PDF appears (demo partial). It includes the record details, timeline with events, and cites “2 CSR 70-25.120” next to wind info.  
  8. *Wrap-up:* “This demo shows end-to-end capture and audit. FieldLog doesn’t claim compliance, but it clearly shows what was done, missing data flagged, and provides source citations in the audit report. All core features have worked as intended.”  

- **5-minute extended script:** (Add detail on editing, data model).  
  - Include showing event timeline log on screen.  
  - Show how a missing crop/pest in site is flagged (“Label mismatch” example).  
  - Show Export packet containing multiple records and a citation list at the end.  

- **Judge Q&A Talking Points:**  
  - *Legal Safety:* FieldLog **does not replace legal judgment**. Flags are marked “needs human review”. (Emphasize “with human review” language and conservative stance.)  
  - *Scope:* Only tracks applications, not growth or integrated pest management advice.  
  - *Sources:* Every rule flagged is footnoted with exact law/reg text【7†L87-L95】【5†L151-L158】.  
  - *Differentiators:* Unlike generic note-taking apps, FieldLog ties logs to actual legal requirements (with citations).  
  - *Data Privacy:* Data stays with farm (permission only within org). Data encrypted at rest.  
  - *AI Use:* Limited to explanation/suggestions (not compliance verdict).  
  - *Offline:* We tested loss of connectivity; sync works when reconnected.  
  - *Next steps:* Add more states, label integration, easier rule updates.  

- **Technical Proof Points:**  
  - Show code snippet for syncing (to evidence real programming, not a no-code tool).  
  - Show JSON of a sample rule or record.  
  - Demonstrate the compliance engine producing a warning.  
  - Mention tech stack (React + Node + Postgres + IndexedDB).  

- **Business Proof Points:**  
  - Market: Large farms have compliance audits, current solutions are paper/Excel – big pain.  
  - Unit economics: Low user volume, focus on enterprise per-farm sales.  
  - MoAg inspection guidance: cite that MDA inspects applicator records at facilities (source: MDA website notes routine checks)【33†L1-L4】.  
  - Extension/adoption: Farmers already used to record books (like MP692 form)【22†L58-L66】, we digitize that.  
  - Differentiation: Automatically linking logs to regulations (source citations) adds trust.

## 15. Risk Register

| **Risk**                         | **Severity** | **Prob.** | **Mitigation**                                     | **Owner**      | **Pitch Response**                                                                         |
|----------------------------------|--------------|-----------|-----------------------------------------------------|----------------|-------------------------------------------------------------------------------------------|
| **Legal overclaim**              | High         | Medium    | Avoid “guarantees”; use qualifiers; always cite rules【7†L87-L95】【41†L136-L143】. | Product        | “We clearly say FieldLog *helps* meet recordkeeping requirements under review, not that it *ensures compliance*. We cite statutes.” |
| **Rule misinterpretation**       | High         | Medium    | Conservative engine; use primary sources; peer review any ambiguous rule. | Product        | “We link every rule to the exact law. Ambiguous items are flagged for human check, not auto-enforced.” |
| **Stale EPA label data**         | Medium       | Low       | Use EPA PPLS API for current labels; allow manual override if a label’s outdated. | Product        | “We plan to sync labels via EPA’s system; users can also attach PDFs to be safe.”             |
| **MO vs other state mismatch**   | Medium       | High      | Limit MVP to MO; mark out-of-state as future. Clearly label as MO-specific functionality. | Product        | “We explicitly target Missouri (for Vibeathon). Expansion to other states requires new regs.” |
| **Offline sync failure**         | High         | Medium    | Test offline flows thoroughly; clear status indicators; queue with retry. | Engineering    | “We tested offline use; FieldLog caches changes and syncs. If sync fails, user is alerted and data queued.” |
| **Contractor adoption**          | Medium       | Medium    | Simple UI; mobile-first; provide demo and training; minimize required text entry. | UX            | “We ensure the contractor app is very simple – fill fields, one tap to submit. It even works offline.” |
| **Seasonal demand**              | Low          | Low       | Recognize after harvest may slowdown; focus pre-season sales. | Business       | “Usage spikes in-season; quieter off-season is normal. We’ll market to farms ahead of planting.” |
| **Low urgency**                  | Medium       | High      | Emphasize liability reduction; partner with Crop Advisors, MO Extension. | Business       | “Farms may see this as optional, but liability and audit pain are strong motivators, especially for larger ops.” |
| **Consultant channel weakness**  | Medium       | Medium    | Engage Extension agents and ag-consultants early; offer free trials. | Business       | “We’re working with the MU Extension to inform ag consultants – they trust Extension-backed advice.” |
| **Pricing resistance**           | Medium       | Medium    | Pilot with a few big farms for testimonials; consider freemium (basic logs only). | Business       | “Our minimum viable pricing covers cloud costs; for small farms, we might offer a free plan or integrate into existing EHR.” |
| **Competitive response**         | High         | Low       | Establish first-mover in pest recordkeeping niche; build strong IP (rules engine, data model). | Business/Tech  | “This idea is novel – competitors are still on paper. We’ll keep innovating (label integration, AI) so it’s hard to copy quickly.” |
| **Data privacy**                 | High         | Low       | Encrypt data, strict org boundaries, comply with privacy laws (GDPR likely N/A, but HIPAA no). | Engineering    | “All data stays within the farm’s private cloud; we don’t sell data. We’re GDPR/HIPAA agnostic but can host in secure cloud.” |
| **Audit liability**              | High         | Low       | Provide clear disclaimers; export with source references; no certification “compliant” wording. | Legal/Product  | “We label all exports as ‘records as reported’ and encourage legal review. Our credibility is in citations, not guarantees.” |

## 16. Roadmap

- **48-hour hackathon plan:** (Solo rapid MVP)  
  1. **Day 1 Morning:** Setup project scaffold (create Git repo, basic React + Node frameworks). Define data model in code, prepare DB (SQLite). Implement User/Role/Organization models and login.  
  2. **Day 1 Afternoon:** Build Manager dashboard, job creation form. Hardcode some demo data (fields, products).  
  3. **Day 2 Morning:** Build Contractor logging screen with offline save/sync (IndexedDB). Capture form fields A–M (with placeholder lists for pests/products).  
  4. **Day 2 Midday:** Implement backend API endpoints for submit, store records.  
  5. **Day 2 Late:** Add compliance checks (required fields). Show warnings in UI.  
  6. **Day 2 Evening:** Add Manager review UI (approve/reject, timeline view).  
  7. **Day 3 (if available):** Implement PDF export (likely HTML->PDF with static data). Fill in citations in export. Polish UI for demo, add offline indicator.

- **7-day build plan:**  
  - Day 3–4: Integrate real product list (from USDA or static list), GPS capture, weather API (or at least static sample).  
  - Day 5: Continue PDF styling, event log detail, source citations content.  
  - Day 6: Add optional AI helper stubs (mock “explain missing fields” messages), finalize security/auth.  
  - Day 7: Testing & bugfixes, UI polish, performance. Prepare demo narrative and slides.  

- **30-day validation plan:**  
  - Early user interviews (farm managers, applicators) with clickable prototype.  
  - Pilot test with 1-2 farms for real data entry.  
  - Adjust data model or UX based on feedback.  
  - Gather actual MDA guidance or consultant feedback to refine compliance logic.  

- **90-day MVP plan:**  
  - Add user management (multi-org).  
  - Integrate official EPA product/label API (PPLS) for auto-populating product info.  
  - Build small mobile apps or improve PWA performance.  
  - Secure beta with 10+ farms, refine AI features (correction drafting, summaries).  
  - Monitor regulatory changes (like the rescission of 7 CFR 110), update rules engine.  

- **12-month roadmap:**  
  - **Q2–Q3:** Release v1.0: Full post-hackathon features, early paying customers (target large farms).  
  - **Q3–Q4:** Expand to other Midwestern states (IN, IL) – add state-specific rules/reg flags.  
  - **Year 2:** Add machine learning for auto-extract from label images, integrate drone data for field mapping. Launch commercial sales + strategic ag partner programs.

## 17. Final Recommendation

**Build This First:** Focus on the **field logging path**: manager creates job → contractor enters record → system flags issues → manager approves → export. Everything revolves around that. Implement immutable records, required fields, offline support, and audit export. That delivers immediate value and demo “wow” factor.

**What to Avoid:** Don’t build anything that implies FieldLog *ensures* legal compliance. Avoid any “approve if OK” flow that auto-clears warnings; always route through manager. Skip any feature requiring complex integrations (e.g. full AIS). Avoid making agronomic recommendations or giving any un-cited advice.

**Demo Focus:** Show the end-to-end journey with the **source-linked compliance checks**. Emphasize the “evidence timeline” and that managers can’t quietly alter contractor logs – they request corrections with chain-of-custody. Highlight the audit PDF’s citations (but don’t recite them in pitch, just show them on a slide).

**Pitch Pointers:**  
- “FieldLog helps you *capture and organize* all required pesticide records according to Missouri law【5†L151-L158】【7†L87-L95】. It doesn’t give legal advice, but it flags missing info and ties each data field to the statute or rule that requires it.”  
- **Do NOT say:** “FieldLog guarantees compliance” or claim it’s a substitute for professional advice. Instead say: “FieldLog makes your records audit-ready by matching entries against Missouri/Federal requirements, with *source citations* to show you why each data point matters【7†L87-L95】【39†L137-L144】.”  
- **Collect next:** Interviews with extension agents or ag managers to refine real-world needs. Gather their examples of recordkeeping forms or inspector checklists. This will help refine UI and identify any overlooked fields.  

**Highest-Leverage Next Step:** Build the core recording feature (mobile form + offline sync + compliance check with one simple rule). This proves the value quickly. Once that works, add one more rule (e.g. weather) and the audit export. That triple (log, check, export) embodies FieldLog’s promise.

In summary: **Focus ruthlessly on the minimal workflow that covers a full application log under Missouri law【7†L87-L95】【5†L151-L158】**. Keep everything transparent and cite-backed. Cut anything that risks legal overreach or dilutes demo focus. With that, you’ll have a compelling hackathon demo and a solid foundation for a real startup.