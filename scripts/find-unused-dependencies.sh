#!/bin/bash

echo "Checking unused dependencies..."

npx depcheck

echo "Checking TypeScript exports..."

npx ts-prune

echo "Checking duplicate packages..."

npm ls