package main

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// gitEnv keeps git non-interactive. Without GIT_TERMINAL_PROMPT=0 an ls-remote
// against a repo the user cannot read will block forever waiting for a
// username; GIT_OPTIONAL_LOCKS=0 keeps a read-only scan from writing index.lock
// into repos the user may have open in an editor.
func gitEnv(base []string) []string {
	return append(base,
		"GIT_TERMINAL_PROMPT=0",
		"GIT_OPTIONAL_LOCKS=0",
		"GCM_INTERACTIVE=never",
		"GIT_SSH_COMMAND=ssh -oBatchMode=yes -oStrictHostKeyChecking=accept-new",
	)
}

// git runs a git command inside dir and returns trimmed stdout.
//
// Errors carry git's own stderr. Without it every network failure collapses to
// "exit status 128", which cannot distinguish "you have no SSH key for this
// host" from "this repository no longer exists" - and those demand opposite
// responses from the user.
func git(ctx context.Context, dir string, args ...string) (string, error) {
	full := append([]string{"-C", dir}, args...)
	cmd := exec.CommandContext(ctx, "git", full...)
	cmd.Env = gitEnv(environ())

	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		if msg := firstUsefulLine(stderr.String()); msg != "" {
			return strings.TrimRight(string(out), "\n"), fmt.Errorf("%s", msg)
		}
	}
	return strings.TrimRight(string(out), "\n"), err
}

// firstUsefulLine picks the line of git stderr that names the actual problem,
// skipping the boilerplate that follows it.
func firstUsefulLine(stderr string) string {
	var fallback string
	for _, line := range splitLines(stderr) {
		line = strings.TrimSpace(line)
		switch {
		case line == "":
			continue
		case strings.HasPrefix(line, "remote: "):
			return strings.TrimPrefix(line, "remote: ")
		case strings.HasPrefix(line, "fatal: "), strings.HasPrefix(line, "error: "):
			if fallback == "" {
				fallback = line
			}
		case strings.Contains(line, "Permission denied"):
			return line
		default:
			if fallback == "" {
				fallback = line
			}
		}
	}
	return fallback
}

// gitLines runs a git command and splits stdout into non-empty lines.
func gitLines(ctx context.Context, dir string, args ...string) ([]string, error) {
	out, err := git(ctx, dir, args...)
	if err != nil {
		return nil, err
	}
	return splitLines(out), nil
}

func splitLines(s string) []string {
	if s == "" {
		return nil
	}
	sc := bufio.NewScanner(strings.NewReader(s))
	sc.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)
	var lines []string
	for sc.Scan() {
		line := sc.Text()
		if strings.TrimSpace(line) != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

var scpLike = regexp.MustCompile(`^([^@/]+@)?([^:/]+):(.+)$`)

// parseRemote normalizes the several URL shapes present in a real machine:
// scp-like SSH (git@github.com:owner/repo.git), SSH host aliases used for
// multi-account setups (git@github.com-npdigital:owner/repo.git), HTTPS, and
// HTTPS with an embedded username (https://user@bitbucket.org/owner/repo.git).
//
// Normalized collapses all of them to host/owner/repo with the alias suffix
// stripped, so two directories pointing at the same GitHub repo through
// different auth paths still collide.
func parseRemote(name, raw string) *Remote {
	r := &Remote{Name: name, URL: raw}
	u := strings.TrimSpace(raw)
	if u == "" {
		return nil
	}

	switch {
	case strings.HasPrefix(u, "http://"), strings.HasPrefix(u, "https://"):
		r.Scheme = "https"
		rest := u[strings.Index(u, "://")+3:]
		if at := strings.Index(rest, "@"); at != -1 && at < strings.Index(rest+"/", "/") {
			r.EmbeddedUser = rest[:at]
			rest = rest[at+1:]
		}
		parts := strings.SplitN(rest, "/", 2)
		r.Host = parts[0]
		if len(parts) > 1 {
			r.Owner, r.Repo = ownerRepo(parts[1])
		}
	case strings.HasPrefix(u, "ssh://"):
		r.Scheme = "ssh"
		rest := u[len("ssh://"):]
		if at := strings.Index(rest, "@"); at != -1 {
			rest = rest[at+1:]
		}
		parts := strings.SplitN(rest, "/", 2)
		r.Host = strings.SplitN(parts[0], ":", 2)[0]
		if len(parts) > 1 {
			r.Owner, r.Repo = ownerRepo(parts[1])
		}
	case strings.HasPrefix(u, "file://"), strings.HasPrefix(u, "/"):
		r.Scheme = "local"
		r.Host = "local"
		r.Repo = filepath.Base(strings.TrimSuffix(u, ".git"))
	default:
		if m := scpLike.FindStringSubmatch(u); m != nil {
			r.Scheme = "ssh"
			if m[1] != "" {
				r.EmbeddedUser = strings.TrimSuffix(m[1], "@")
			}
			r.Host = m[2]
			r.Owner, r.Repo = ownerRepo(m[3])
		} else {
			r.Scheme = "unknown"
			r.Host = "unknown"
			r.Repo = filepath.Base(strings.TrimSuffix(u, ".git"))
		}
	}

	// An SSH host alias (github.com-npdigital) is a local ~/.ssh/config name for
	// a real host. Keep the alias for diagnostics but normalize it away so the
	// collision check sees the true identity.
	if canon, alias := canonicalHost(r.Host); alias != "" {
		r.SSHAlias = r.Host
		r.Host = canon
	}

	r.Normalized = strings.ToLower(strings.TrimSuffix(
		strings.Trim(r.Host+"/"+r.Owner+"/"+r.Repo, "/"), ".git"))
	// An embedded username is auth detail, not identity, and is already excluded
	// from Normalized above.
	return r
}

// canonicalHost strips a trailing -alias from known forge hostnames.
func canonicalHost(host string) (string, string) {
	for _, base := range []string{"github.com", "gitlab.com", "bitbucket.org"} {
		if host == base {
			return base, ""
		}
		if strings.HasPrefix(host, base+"-") {
			return base, host
		}
	}
	return host, ""
}

func ownerRepo(path string) (string, string) {
	path = strings.TrimPrefix(path, "/")
	path = strings.TrimSuffix(path, ".git")
	parts := strings.Split(path, "/")
	if len(parts) == 1 {
		return "", parts[0]
	}
	return strings.Join(parts[:len(parts)-1], "/"), parts[len(parts)-1]
}

// refLine is one `git for-each-ref` record.
type refLine struct {
	name      string
	sha       string
	upstream  string
	committed time.Time
}

const refFormat = "%(refname:short)%09%(objectname)%09%(upstream:short)%09%(committerdate:unix)"

func parseRefLines(lines []string) []refLine {
	refs := make([]refLine, 0, len(lines))
	for _, line := range lines {
		// Tab-separated so branch names containing spaces (git allows them)
		// cannot shift the fields.
		f := strings.Split(line, "\t")
		if len(f) < 2 || f[0] == "" {
			continue
		}
		r := refLine{name: f[0], sha: f[1]}
		if len(f) > 2 {
			r.upstream = f[2]
		}
		if len(f) > 3 {
			if unix, err := strconv.ParseInt(strings.TrimSpace(f[3]), 10, 64); err == nil && unix > 0 {
				r.committed = time.Unix(unix, 0)
			}
		}
		refs = append(refs, r)
	}
	return refs
}

// forgeHosts are hosts where an HTTPS remote has a mechanical SSH equivalent.
var forgeHosts = map[string]bool{
	"github.com": true, "gitlab.com": true, "bitbucket.org": true,
}

// sshFallbackURL returns the SSH form of an HTTPS remote, or "".
//
// This matters because GitHub answers "Repository not found" (404, not 403) for
// a private repository when the caller is unauthenticated. A stale keychain
// entry therefore makes a perfectly healthy private repo look deleted. SSH keys
// are usually still valid when a stored HTTPS token is not, so retrying over
// SSH distinguishes "I cannot log in" from "this repository is gone" - a
// distinction that decides whether local code is the only copy.
func sshFallbackURL(r *Remote) string {
	if r == nil || r.Scheme != "https" || r.Owner == "" || r.Repo == "" {
		return ""
	}
	if !forgeHosts[r.Host] {
		return ""
	}
	host := r.Host
	if r.SSHAlias != "" {
		host = r.SSHAlias
	}
	return "git@" + host + ":" + r.Owner + "/" + r.Repo + ".git"
}

// containedIn reports whether commit `local` is an ancestor of (or equal to)
// commit `remote`, and whether that question could be answered at all.
//
// This is what separates "I have work the server does not" from "the server is
// simply ahead of me". A branch that is behind its remote has every one of its
// commits stored server-side, so it is fully backed up even though the two SHAs
// differ. Treating a differing SHA as unpushed would wrongly block archiving and
// wrongly offer a push that could only fail.
//
// The answer is unknowable without the remote commit in the local object store,
// which is why known=false is reported rather than guessed at.
func containedIn(ctx context.Context, dir, local, remote string) (contained bool, known bool) {
	if local == "" || remote == "" {
		return false, false
	}
	if local == remote {
		return true, true
	}
	// Without the remote commit locally there is nothing to compare against.
	if _, err := git(ctx, dir, "cat-file", "-e", remote+"^{commit}"); err != nil {
		return false, false
	}
	if _, err := git(ctx, dir, "merge-base", "--is-ancestor", local, remote); err != nil {
		return false, true
	}
	return true, true
}

// fetchRemote updates remote-tracking refs so containment questions become
// answerable. It creates no commits and changes no working tree; it is opt-in
// because a plain inventory should not touch the repositories it reports on.
func fetchRemote(ctx context.Context, dir, remote string, timeout time.Duration) error {
	cctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	_, err := git(cctx, dir, "fetch", "--quiet", "--no-tags", remote)
	return err
}

// lsRemoteRefs returns remote refname -> SHA. This is the only trustworthy way
// to know a branch is on the server: a remote-tracking ref survives locally
// after the remote branch is deleted, so `@{upstream}` can report "ahead 0" for
// a branch that no longer exists anywhere but this machine.
func lsRemoteRefs(ctx context.Context, dir, remote string, timeout time.Duration) (map[string]string, error) {
	cctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	out, err := git(cctx, dir, "ls-remote", "--heads", "--tags", remote)
	if err != nil {
		return nil, err
	}
	refs := make(map[string]string)
	for _, line := range splitLines(out) {
		f := strings.Fields(line)
		if len(f) != 2 {
			continue
		}
		// Peeled tag entries (refs/tags/x^{}) point at the commit; keep the
		// tag object SHA under the plain name and ignore the peeled form.
		if strings.HasSuffix(f[1], "^{}") {
			continue
		}
		refs[f[1]] = f[0]
	}
	return refs, nil
}
