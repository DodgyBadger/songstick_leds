# Product requirements

[`requirements.md`](requirements.md) is the current authoritative product
specification. Keep its path stable so plans, ADRs, issues, and external links
can refer to it without following versioned filenames.

## Versioning

The version records the maturity of the specification, not a software release:

- Increment the minor version for meaningful requirement additions or changes.
- Increment the major version when the product scope or foundational behavior
  changes substantially.
- Correct wording and formatting without incrementing the version when meaning
  is unchanged.
- Update the document date whenever its meaning changes.

Git history is the normal revision history. Preserve a frozen copy under
`archive/` only when a specification becomes an external review baseline or is
superseded by a materially different document. Name snapshots such as
`requirements-v1.0.md`; do not create a snapshot for every edit.

Implementation choices belong in ADRs, while delivery sequencing belongs in
implementation plans. Link those records to the relevant requirements rather
than adding their detail to the product specification.
