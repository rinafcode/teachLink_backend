# License Compliance

## Overview
This directory contains license compliance scanning and reporting for the teachLink backend project.

## Structure
```
compliance/
├── configs/
│   ├── license-policy.yml    # Defines allowed/prohibited licenses
│   └── scanner-config.yml     # Scanner configuration
├── reports/
│   └── license-report-*.json # Generated compliance reports
└── README.md                  # This file
```

## Running License Scans

### Local Development
```bash
npm run license:scan
```

### Output
The scan will output:
- **Allowed**: Packages with acceptable licenses
- **Prohibited**: Packages with licenses that must be removed/replaced
- **Unknown**: Packages with unclear or missing license information
- **Review Required**: Packages requiring manual review (e.g., LGPL)

## License Policy

### Allowed Licenses
- MIT, Apache-2.0, BSD-2/3/4-Clause
- ISC, MPL-2.0, CC0-1.0, Unlicense
- Python-2.0, BlueOak-1.0.0, CC-BY-4.0

### Prohibited Licenses
- GPL-3.0, AGPL-3.0, SSPL-1.0
- Proprietary licenses

### Requires Review
- LGPL-2.1, LGPL-3.0 (acceptable for dynamic linking)

## CI/CD Integration
The license scan runs automatically on:
- Push to main/develop branches
- Pull requests to main/develop branches

The workflow will:
- **FAIL** if prohibited licenses are found
- **WARN** if packages require manual review

## Handling Review Required
If the scan returns WARNING status:
1. Review the report in `compliance/reports/`
2. For LGPL packages: Ensure dynamic linking is used (not static)
3. For unknown packages: Verify the package is open source and acceptable
4. Document approval in PR comments or issue