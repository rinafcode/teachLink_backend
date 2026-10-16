# Licensing Policy

**Policy version:** 1.0.0  
**Effective date:** 2026-09-28

## Purpose and scope

This policy establishes the licensing framework for TeachLink Backend, including project license governance, the inbound-equals-outbound rule, and procedures for license changes. It applies to all code, documentation, and assets maintained in the TeachLink Backend repository.

## Project license

TeachLink Backend is currently unlicensed (`UNLICENSED` in package.json), meaning it is proprietary and not licensed for public use, modification, or distribution without explicit permission from the project maintainers.

## Inbound-equals-outbound rule

All contributions to TeachLink Backend must be licensed under terms compatible with the project's current license status:

- **Current status**: As an unlicensed project, all contributions are made under the understanding that they become part of the proprietary codebase
- **Contributor requirements**: Contributors retain copyright but grant the project maintainers full rights to use, modify, and distribute their contributions as part of TeachLink Backend
- **Future licensing**: If the project adopts an open source license in the future, all existing contributions must be compatible with that license or require explicit re-licensing from contributors

## License decision authority

License changes for TeachLink Backend require approval according to the following hierarchy:

### Major license changes
Changes that affect the fundamental licensing model (e.g., transitioning from proprietary to open source, changing to a different license family) require:

1. **Maintainer consensus**: All active maintainers must approve the change
2. **Legal review**: Legal counsel must review implications and compatibility
3. **Contributor notification**: All past contributors must be notified of the proposed change
4. **Documentation update**: This policy, package.json, and any LICENSE file must be updated consistently

### Minor license changes
Administrative updates (e.g., correcting license metadata, updating contact information) require:

1. **Maintainer approval**: At least two maintainers must approve the change
2. **Documentation consistency**: All license-related files must remain synchronized

## License change procedures

### Evaluation process
Before proposing a license change:

1. **Impact assessment**: Evaluate compatibility with existing dependencies (see THIRD_PARTY_LICENSES.md)
2. **Contributor analysis**: Identify all past contributors and their contribution scope
3. **Business alignment**: Ensure the proposed license aligns with project goals and business requirements
4. **Legal consultation**: Obtain legal review for licensing implications

### Implementation process
For approved license changes:

1. **Update package.json**: Modify the license field
2. **Create LICENSE file**: Add appropriate license text to the repository root
3. **Update documentation**: Revise README.md and relevant documentation
4. **Update this policy**: Increment version and document the change
5. **Dependency verification**: Ensure all dependencies remain compatible under the new license
6. **CI/CD updates**: Update any license scanning or compliance checks

## Compliance and enforcement

### License verification
- All pull requests must maintain license compatibility
- Automated license scanning validates third-party dependencies
- Contributors must not introduce code under incompatible licenses

### Violation handling
License violations are treated as critical issues requiring immediate resolution:

1. **Identification**: Violations detected by automated scanning or manual review
2. **Remediation**: Remove incompatible code or obtain proper licensing
3. **Documentation**: Record resolution in the relevant pull request or issue

## Related policies

This policy works in conjunction with:
- **THIRD_PARTY_LICENSES.md**: Governs acceptable licenses for dependencies
- **CONTRIBUTOR_SIGNOFF.md**: Defines contributor agreement requirements
- **DCO.md**: Developer Certificate of Origin requirements (if applicable)

## Version history

- 1.0.0 (2026-09-28): Establish the project licensing policy framework for TeachLink Backend.