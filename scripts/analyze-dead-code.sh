#!/bin/bash

echo "Running dead code analysis"

npx ts-prune > reports/unused-exports.txt

npx depcheck > reports/unused-dependencies.txt

echo "Analysis complete"