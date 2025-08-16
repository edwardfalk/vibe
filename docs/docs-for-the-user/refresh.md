{my query (e.g. It still throws an error)}

---

Use this template when you need the AI assistant to **diagnose and fix an issue** in the Vibe code-base.
All guidance assumes Windows cmd.exe and Desktop-Commander tools.

### Initial Task Risk Assessment

1. Classify the debugging task as HIGH-RISK or STANDARD-RISK.  
2. Output classification with justification; ask questions if unclear.

### 1. Understand the Architecture First

• List the workspace (depth ≤ 4).  
• Open key files (entry points, configs) with the file-reader helper.  
• Summarise relevant architecture.

### 2. Assess the Issue Holistically

• Collect error messages, logs, stack traces.  
• Hypothesise ≥3 root causes across layers.  
• For HIGH-RISK, inspect referenced files to confirm hypotheses.

### 3. Discover Reusable Solutions

• Search the codebase for similar issues & existing utilities.  
• Note reusable error handlers or patterns.

### 4. Analyze with Engineering Rigor

• Trace dependencies in affected files.  
• Verify adherence to principles & conventions.  
• Assess performance & maintainability impacts.

### 5. Propose Strategic Solutions

• Offer 1-2 architecturally sound fixes with exact file edits (or pseudocode).  
• Include rollback steps for HIGH-RISK.

### 6. Validate Like a Professional

• Define ≥3 test scenarios, validation methods, monitoring, regression mitigations.

### Execution Guidelines

• Follow sections sequentially.  
• Use Desktop-Commander helpers for listing, reading, searching, and editing files.  
• Log any deviations for audit.
