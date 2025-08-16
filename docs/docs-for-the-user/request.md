{my request (e.g. Develop feature xyz)}

---

Use this template when you want the AI assistant to **add a new feature or refactor code**.
The language is already adapted for the Vibe repo (Windows, Desktop-Commander, no bashisms).

### Initial Task Risk Assessment

1. **Classify the task** as HIGH-RISK or STANDARD-RISK (see core rules).
2. Output the classification and justify it.
3. Ask clarifying questions if scope is ambiguous.

### 1. Architectural Understanding

• List the workspace (depth ≤ 4) with the directory-listing helper.  
• Open representative files with the file-reader helper.  
• Summarise architecture and planned insertion point.

### 2. Requirements Engineering

• Translate the request into 3-5 measurable requirements.  
• Identify stakeholders & use-cases.  
• Capture constraints & boundaries.

### 3. Code Reusability Analysis

• Search the codebase for existing helpers.  
• List reusable pieces; propose extractions if valuable.

### 4. Technical Discovery

• Trace all affected files, dependencies, cross-cutting concerns.  
• Highlight missing tests/docs.

### 5. Implementation Strategy

• Propose a step-by-step plan (3-5 edits/creations) with absolute paths.  
• Include backups & rollback for HIGH-RISK.

### 6. Quality Assurance Framework

• Define ≥ 5 test scenarios, validation methods, monitoring, rollback.

### Execution Guidelines

• Follow sections sequentially.  
• Use Desktop-Commander helpers for all file operations.  
• Log deviations for audit.
