# Vietnam administrative data

`vietnam-administrative-2025.json` contains the two-level administrative list in effect from July 1, 2025:

- 34 province-level units
- 3,321 commune-level units (wards, communes, and special zones)
- Former province names used as search aliases for the pre-merger 63-province list

Primary reference: Decision 19/2025/QD-TTg, published by the Government of Vietnam.

The normalized JSON was generated from `vietnam-address-database@1.0.0` (MIT), whose records are based on Resolution 202/2025/QH15. Keep the province and ward count validations in `shop.js` when replacing this file.
