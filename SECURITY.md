# Security

Please report vulnerabilities privately through GitHub's
[security advisory form](../../security/advisories/new) instead of a public
issue. You'll get a response within a few days.

Tarn makes no network requests and requires only the `storage`, `sidePanel`, `offscreen` and `favicon`
permissions. `favicon` lets Tarn show icons Chrome already has cached; it
does not read pages or browsing history.
It may ask for the optional `management` permission, and only when you
choose to let it switch off another new-tab extension.
Any change that widens that surface gets extra review.
