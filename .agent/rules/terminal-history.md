---
trigger: always_on
description: Prevent polluting shell history by disabling it at the start of every session or multi-command execution.
---

Prevent pollution by running at session start:
```zsh
unset HISTFILE; unsetopt share_history
```
