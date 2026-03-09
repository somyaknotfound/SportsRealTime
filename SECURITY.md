# Security

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please send an e-mail to the maintainers. All security vulnerabilities will be promptly addressed.

## Handling Leaked Secrets

If a secret (such as an APM license key, API key, or database credential) is accidentally committed to the repository, follow these steps immediately:

1. **Rotate the Key:** Immediately regenerate or revoke the exposed secret in the relevant service's dashboard. The leaked key should be considered compromised and must not be used anymore.
2. **Remove the Secret from Code:** Delete the file containing the secret or remove the secret from the file.
3. **Update `.gitignore`:** Ensure the file containing the secret is added to `.gitignore` so it is not committed again.
4. **Scrub Git History:** Use tools like `git filter-repo` or BFG Repo-Cleaner to completely remove the secret from the repository's history.
   - *Example using `git filter-repo`:*
     ```bash
     git filter-repo --invert-paths --path <path-to-leaked-file>
     ```
   - Alternatively, use BFG Repo-Cleaner to replace text or remove files.
5. **Force Push:** After scrubbing the history, force push the changes to all branches on the remote repository (`git push origin --force --all`).
6. **Notify the Team:** Inform all contributors that the history has been rewritten and they will need to re-clone or rebase their local repositories.
