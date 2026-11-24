#!/bin/sh
# usage: sh assets/cards/prompts/run.sh <batch-number>
# Codex CLI로 카드 그림을 생성해 assets/cards/originals 에 저장한다.
# 다른 Codex 계정을 쓰려면 실행 전에 CODEX_HOME 을 그 계정 폴더로 지정한다.
# 생성 후: python scripts/optimize-cards.py && npm run manifest
cd "$(dirname "$0")/../../.." || exit 1
R=assets/cards/prompts
mkdir -p assets/cards/originals
codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C "$(pwd)" \
  --image $R/ref-01_gwang.png,$R/ref-08_gwang.png,$R/ref-12_ssangpi.png - \
  < $R/batch-$1.md > $R/batch-$1.log 2>&1
echo "batch $1 exit $?"
