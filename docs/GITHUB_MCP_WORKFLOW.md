# GitHub MCP Workflow (Vibe)

Purpose
- Use GitHub MCP tools directly for PR triage, reviews, comments, issues, and CI control. Replaces legacy fetch scripts.

Core tools (kept enabled)
- PRs: get/list PRs, files, diff, status, reviews, comments
- Reviews/comments: get_pull_request_reviews, get_pull_request_comments, get_issue_comments
- Issues: create/get/update/add_comment
- CI: list_workflows, list_workflow_runs, get_workflow_run/status, rerun_failed_jobs, rerun_workflow_run, run_workflow, cancel_workflow_run

Typical flows
- Triage open PRs
  1) list_pull_requests(state: open)
  2) get_pull_request_files + get_pull_request_diff
  3) get_pull_request_status
  4) get_pull_request_reviews + get_pull_request_comments
  5) filter author=Coderabbit: use get_issue_comments(issue_number) and filter login==coderabbitai[bot]

- Respond to CodeRabbit review
  1) create_pending_pull_request_review
  2) add_comment_to_pending_review (repeat)
  3) submit_pending_pull_request_review(event: COMMENT/REQUEST_CHANGES/APPROVE)

- Trigger a CodeRabbit review manually
  - add_issue_comment on the PR issue: "@coderabbitai review"

- Merge
  - merge_pull_request(merge_method: squash|merge|rebase)

- CI ops
  - rerun_failed_jobs(run_id) or rerun_workflow_run(run_id)
  - run_workflow(workflow_id, ref)
  - cancel_workflow_run(run_id)

What we removed
- Legacy fetch/aggregation scripts and scheduled workflows that tried to collect CodeRabbit artifacts. They’re redundant now.

Notes
- Keep `.github/workflows/coderabbit-review.yml` for automatic PR reviews.
- `.coderabbit.yaml` is fixed (single `reviews` block). If CodeRabbit warns again, update here.
- If clutter returns, disable low-value GitHub tools first (artifacts, sub-issues).
